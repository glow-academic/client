"""Persona completion handler - listens to generate_call_complete events and emits granular persona events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.examples.get import get_examples_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.icons.get import get_icons_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.types import PersonaGenerationCompleteEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_persona_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete and generate_text_complete events - filter by persona artifact_type and emit granular event."""
    # Skip processing if in eval mode - benchmark handlers will handle evals
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return  # Don't process evals - benchmark handlers will handle them

    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    # Extract all data from event
    group_id_str = data.get("group_id")
    resource_type = data.get("resource_type")
    event_type = data.get("event_type")

    # Handle text completion - save assistant message
    if event_type == "text_complete":
        await _handle_persona_text_complete(sid, data)
        return

    # Handle run complete - save final assistant content + update tokens
    if event_type == "run_complete":
        await _handle_persona_run_complete(sid, data)
        return

    # Only process tool completion events for resource generation
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return
    resource_id_str = tool_result.get("resource_id")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
        # Check if this was a tool failure (e.g., duplicate key error)
        # In that case, the error was already returned to the model for retry
        # and we don't need to emit an error event to the client
        tool_success = tool_result.get("success", True)
        if not tool_success:
            # Tool execution failed - this is expected and model can retry
            # Don't emit error since other successful calls may have completed
            return
        await sio.emit(
            "persona_generation_error",
            {
                "artifact_type": "persona",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    # Fetch full resource data using service layer (with caching)
    # Build the event with the appropriate resource field populated
    event = PersonaGenerationCompleteEvent(
        artifact_type="persona",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            # Fetch the resource using the appropriate internal function
            # Each function handles caching and returns the correct type
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                event.description_resource = items[0] if items else None
            elif resource_type == "colors":
                items = await get_colors_internal(conn, [resource_id])
                event.color_resource = items[0] if items else None
            elif resource_type == "icons":
                items = await get_icons_internal(conn, [resource_id])
                event.icon_resource = items[0] if items else None
            elif resource_type == "instructions":
                items = await get_instructions_internal(conn, [resource_id])
                event.instructions_resource = items[0] if items else None
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                event.flag_resource = items[0] if items else None
            elif resource_type == "departments":
                items = await get_departments_internal(conn, [resource_id])
                event.department_resources = items if items else None
            elif resource_type == "parameter_fields" or resource_type == "fields":
                items = await get_parameter_fields_internal(conn, [resource_id])
                event.parameter_field_resources = items if items else None
            elif resource_type == "examples":
                items = await get_examples_internal(conn, [resource_id])
                event.example_resources = items if items else None
            elif resource_type == "parameters":
                items = await get_parameters_internal(conn, [resource_id])
                event.parameter_resources = items if items else None
    except Exception as e:
        # Resource fetch failed - emit error to client
        await sio.emit(
            "persona_generation_error",
            {
                "artifact_type": "persona",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Emit the typed event
    await sio.emit(
        "persona_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


async def _handle_persona_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle persona text generation completion - save assistant message."""
    run_id = data.get("run_id")
    final_content = data.get("text") or ""

    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            await conn.execute(
                """
                INSERT INTO messages_entry (run_id, role, content, completed, created_at, updated_at)
                VALUES ($1, 'assistant'::message_type, $2, true, NOW(), NOW())
                """,
                uuid.UUID(run_id),
                final_content,
            )
    except Exception as e:
        logger.exception(f"Failed to save persona text message: {str(e)}")


async def _handle_persona_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle persona generation run completion - save assistant output if present."""
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
            # Save assistant message if there's text output (and wasn't already saved by text_complete)
            if assistant_output:
                # Check if assistant message already exists for this run
                existing = await conn.fetchval(
                    """
                    SELECT id FROM messages_entry
                    WHERE run_id = $1 AND role = 'assistant'::message_type
                    LIMIT 1
                    """,
                    uuid.UUID(run_id),
                )
                if not existing:
                    await conn.execute(
                        """
                        INSERT INTO messages_entry (run_id, role, content, completed, created_at, updated_at)
                        VALUES ($1, 'assistant'::message_type, $2, true, NOW(), NOW())
                        """,
                        uuid.UUID(run_id),
                        assistant_output,
                    )

            # Update run with token counts
            if input_tokens or output_tokens:
                await conn.execute(
                    """
                    UPDATE runs_entry
                    SET input_tokens = COALESCE($2, input_tokens),
                        output_tokens = COALESCE($3, output_tokens)
                    WHERE id = $1
                    """,
                    uuid.UUID(run_id),
                    input_tokens,
                    output_tokens,
                )
    except Exception as e:
        logger.exception(f"Failed to save persona run complete: {str(e)}")


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# This registers the event type in OpenAPI, enabling frontend type extraction
# =============================================================================


@server_router.post("/persona_generation_complete")
async def persona_generation_complete_api(
    request: PersonaGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Persona generation completed.

    Emitted when a persona resource is successfully generated.
    Contains full resource objects for immediate frontend use.
    """
    return {"success": True}

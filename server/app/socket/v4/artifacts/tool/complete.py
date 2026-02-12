"""Tool completion handler - listens to generate_call_complete events and emits granular tool events.

Following persona gold standard: fetches full resource objects via *_internal() functions
and emits ToolGenerationCompleteEvent with complete data for immediate frontend use.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.arg_positions.get import get_arg_positions_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.tool.types import ToolGenerationCompleteEvent
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_tool_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete and generate_text_complete events - filter by tool artifact_type and emit granular event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "tool":
        return

    sid = data.get("sid", "")
    if not sid:
        return

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
        await _handle_tool_text_complete(sid, data)
        return

    # Handle run complete - save final assistant content + update tokens
    if event_type == "run_complete":
        await _handle_tool_run_complete(sid, data)
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
        # Check if this was a tool failure
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        await sio.emit(
            "tool_generation_error",
            {
                "artifact_type": "tool",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    # Build the event with the appropriate resource field populated
    event = ToolGenerationCompleteEvent(
        artifact_type="tool",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            # Fetch full resource using the appropriate internal function
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                event.description_resource = items[0] if items else None
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                event.flag_resource = items[0] if items else None
            elif resource_type == "args":
                items = await get_args_internal(conn, [resource_id])
                event.args_resources = items if items else None
            elif resource_type == "arg_positions":
                items = await get_arg_positions_internal(conn, [resource_id])
                event.arg_position_resources = items if items else None
            elif resource_type == "args_outputs":
                items = await get_args_outputs_internal(conn, [resource_id])
                event.args_outputs_resources = items if items else None
    except Exception as e:
        # Resource fetch failed - emit error to client
        await sio.emit(
            "tool_generation_error",
            {
                "artifact_type": "tool",
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
        "tool_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


async def _handle_tool_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle tool text generation completion - save assistant message."""
    run_id = data.get("run_id")
    final_content = data.get("text") or ""

    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            await conn.fetchval(
                create_message_sql,
                uuid.UUID(run_id),
                "assistant",
                final_content,
                True,
                False,
            )
    except Exception as e:
        logger.exception(f"Failed to save tool text message: {str(e)}")


async def _handle_tool_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle tool generation run completion - save assistant output if present."""
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
                existing = await conn.fetchval(
                    """
                    SELECT id FROM messages_entry
                    WHERE run_id = $1 AND role = 'assistant'::message_type
                    LIMIT 1
                    """,
                    uuid.UUID(run_id),
                )
                if not existing:
                    create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
                    await conn.fetchval(
                        create_message_sql,
                        uuid.UUID(run_id),
                        "assistant",
                        assistant_output,
                        True,
                        False,
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
        logger.exception(f"Failed to save tool run complete: {str(e)}")


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# This registers the event type in OpenAPI, enabling frontend type extraction
# =============================================================================


@server_router.post("/tool_generation_complete")
async def tool_generation_complete_api(
    request: ToolGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Tool generation completed.

    Emitted when a tool resource is successfully generated.
    Contains full resource objects for immediate frontend use.
    """
    return {"success": True}

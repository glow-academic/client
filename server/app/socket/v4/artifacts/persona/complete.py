"""Persona completion handler - handles run/text completion and multi-agent coordination.

Resource-level tool_call_complete/tool_result events are now handled by the shared
resource_complete.py handler. This module handles:
- text_complete: save assistant messages
- run_complete: coordinate multi-agent completion via generation_tracker, auto-save persona
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.persona.save import save_persona_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    cleanup_generation,
    record_agent_complete,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.types import PersonaGenerationCompleteEvent
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
async def handle_persona_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete and generate_text_complete events - filter by persona artifact_type."""

    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event_type = data.get("event_type")

    # Handle text completion - save assistant message
    if event_type == "text_complete":
        await _handle_persona_text_complete(sid, data)
        return

    # Handle run complete - coordinate multi-agent, auto-save persona
    if event_type == "run_complete":
        await _handle_persona_run_complete(sid, data)
        return

    # tool_call_complete and tool_result events are now handled by
    # resource_complete.py (shared handler) - nothing to do here


async def _handle_persona_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle persona text generation completion - save assistant message."""
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
        logger.exception(f"Failed to save persona text message: {str(e)}")


async def _handle_persona_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle persona generation run completion.

    Coordinates multi-agent completion via generation_tracker:
    1. Records this agent's completion
    2. If all agents done: auto-saves persona, emits persona_generation_complete
    3. Cleans up generation tracking
    """
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)
    group_id_str = data.get("group_id")

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
            # Save assistant message if there's text output
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
        logger.exception(f"Failed to save persona run complete: {str(e)}")

    # Multi-agent coordination via generation tracker
    tool_results = data.get("tool_results") or []
    is_complete, all_tool_results = await record_agent_complete(run_id, tool_results)

    if is_complete:
        # All agents finished - emit simplified persona_generation_complete
        persona_id: str | None = None

        # Auto-save persona if we have a profile
        profile_id_str = await find_profile_by_socket(sid)
        if profile_id_str and group_id_str:
            try:
                profile_id = uuid.UUID(profile_id_str)
                group_id = uuid.UUID(group_id_str)

                # Build resource_actions from all_tool_results
                resource_actions: dict[str, Any] = {}
                for tr in all_tool_results:
                    if isinstance(tr, dict):
                        rt = tr.get("resource_type")
                        rid = tr.get("resource_id")
                        if rt and rid:
                            resource_actions[rt] = {"resource_id": rid}

                async with get_db_connection() as conn:
                    saved_id = await save_persona_internal(
                        conn=conn,
                        profile_id=profile_id,
                        group_id=group_id,
                        resource_actions=resource_actions,
                    )
                    if saved_id:
                        persona_id = str(saved_id)
            except Exception as e:
                logger.exception(f"Failed to auto-save persona: {str(e)}")

        event = PersonaGenerationCompleteEvent(
            artifact_type="persona",
            group_id=group_id_str or "",
            run_id=run_id,
            success=True,
            message="Persona generation completed",
            persona_id=persona_id,
        )

        await sio.emit(
            "persona_generation_complete",
            event.model_dump(mode="json"),
            room=sid,
        )

        await cleanup_generation(run_id)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/persona_generation_complete")
async def persona_generation_complete_api(
    request: PersonaGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Persona generation completed.

    Emitted when all agents have finished generating persona resources.
    Contains optional persona_id if auto-save succeeded.
    """
    return {"success": True}

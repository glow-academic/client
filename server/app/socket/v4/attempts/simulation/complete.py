"""Simulation attempt completion handler - listens to generate_text_complete events and saves to DB."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.attempts.simulation.types import AttemptCompleteEvent
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_IS_GENERAL = "app/sql/v4/queries/attempts/general/is_general_chat_complete.sql"


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/complete", response_model=dict[str, bool])
async def attempt_complete_api(request: AttemptCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation completed, message saved."""
    return {"success": True}


@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_attempt_complete(data: dict[str, Any]) -> None:
    """Handle generate_text_complete event - filter by attempt artifact_type, save to DB, emit completion."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid to verify connection
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    event_type = data.get("event_type")
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    run_id = data.get("run_id")
    group_id = data.get("group_id")

    # Only process run_complete events with a message_id
    if event_type != "run_complete" or not message_id:
        return

    assistant_output = data.get("assistant_output") or data.get("text", "")
    input_tokens = data.get("input_text_tokens") or 0
    output_tokens = data.get("output_text_tokens") or 0

    try:
        async with get_db_connection() as conn:
            # Determine chat type to use correct SQL
            if chat_id:
                is_general_sql = load_sql(SQL_PATH_IS_GENERAL)
                is_general_row = await conn.fetchrow(is_general_sql, uuid.UUID(chat_id))
                is_general = (
                    bool(is_general_row["is_general"]) if is_general_row else False
                )
            else:
                is_general = False

            # Save assistant message to database using the appropriate function
            func_name = (
                "socket_general_complete_assistant_message_v4"
                if is_general
                else "socket_practice_complete_assistant_message_v4"
            )
            await conn.fetchrow(
                f"SELECT * FROM {func_name}($1, $2, $3, $4)",
                uuid.UUID(message_id),
                assistant_output,
                input_tokens,
                output_tokens,
            )

    except Exception as e:
        logger.exception(f"Failed to save attempt message: {str(e)}")
        # Continue to emit completion even if save fails - client should still be notified

    # Emit attempt_complete event
    complete_event = AttemptCompleteEvent(
        artifact_type="attempt",
        chat_id=chat_id,
        message_id=message_id,
        final_content=assistant_output,
        completed=True,
        group_id=group_id or "",
        resource_type="simulation",
        run_id=run_id,
        success=True,
        message="Attempt generation completed successfully",
    )
    await sio.emit(
        "attempt_complete",
        complete_event.model_dump(mode="json"),
        room=sid,
    )

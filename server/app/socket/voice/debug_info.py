"""Handler for voice_debug_info WebSocket event."""

import uuid
from typing import Any

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceDebugInfoPayload(BaseModel):
    """Client-to-server payload for voice_debug_info."""

    chat_id: str
    content: str


class VoiceDebugInfoErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


# Emit helper functions
async def voice_debug_info_error(
    payload: VoiceDebugInfoErrorPayload, room: str
) -> None:
    await sio.emit("voice_debug_info_error", payload.model_dump(), room=room)


async def _voice_debug_info_impl(sid: str, data: VoiceDebugInfoPayload) -> None:
    """Handle debug_info tool call from Realtime API.

    When debug_info tool is called, save it to the current model run.
    """
    try:
        logger.info(
            f"Received voice_debug_info from {sid}: chat_id={data.chat_id}, content_length={len(data.content)}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await voice_debug_info_error(
                VoiceDebugInfoErrorPayload(
                    success=False, message="Missing chat_id"
                ),
                room=sid,
            )
            return

        content = data.content
        if not content:
            await voice_debug_info_error(
                VoiceDebugInfoErrorPayload(
                    success=False, message="Missing content"
                ),
                room=sid,
            )
            return

        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            await voice_debug_info_error(
                VoiceDebugInfoErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            chat_id_uuid = uuid.UUID(chat_id)

            # Get the latest run for this chat
            sql_get_latest_run = load_sql(
                "sql/v3/simulations/get_latest_run_for_chat.sql"
            )
            run_row = await conn.fetchrow(sql_get_latest_run, str(chat_id_uuid))

            if not run_row:
                logger.warning(
                    f"No run found for chat {chat_id}, cannot save debug info"
                )
                # Don't error - just log and return
                return

            run_id = uuid.UUID(run_row["run_id"])

            # Insert debug info
            sql_insert_debug_info = load_sql(
                "sql/v3/model_runs/insert_debug_info.sql"
            )
            await conn.execute(sql_insert_debug_info, run_id, content)

            logger.info(
                f"Saved debug info for run {run_id} in chat {chat_id}: {content[:100]}..."
            )

    except Exception as e:
        logger.error(
            f"Error in voice_debug_info for {sid}: {str(e)}", exc_info=True
        )
        await voice_debug_info_error(
            VoiceDebugInfoErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def voice_debug_info(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceDebugInfoPayload(**data)
        await _voice_debug_info_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in voice_debug_info for {sid}: {e}")
        await voice_debug_info_error(
            VoiceDebugInfoErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


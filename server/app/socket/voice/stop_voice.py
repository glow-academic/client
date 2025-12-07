"""Handler for stop_voice WebSocket event."""

from typing import Any

from app.main import _voice_message_ids, _voice_sessions, sio
from app.utils.logging.db_logger import get_logger
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class StopVoicePayload(BaseModel):
    """Client-to-server payload for stop_voice."""

    chat_id: str


class StopVoiceErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


class StopVoiceResponsePayload(BaseModel):
    """Server-to-client response payload."""

    success: bool
    message: str


# Emit helper functions
async def stop_voice_error(payload: StopVoiceErrorPayload, room: str) -> None:
    await sio.emit("stop_voice_error", payload.model_dump(), room=room)


async def stop_voice_response(
    payload: StopVoiceResponsePayload, room: str
) -> None:
    await sio.emit("stop_voice_response", payload.model_dump(), room=room)


async def _stop_voice_impl(sid: str, data: StopVoicePayload) -> None:
    """Handle voice session stop requests via WebSocket."""
    try:
        logger.info(f"Received stop_voice request from {sid} for chat {data.chat_id}")

        chat_id = data.chat_id
        if not chat_id:
            await stop_voice_error(
                StopVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        # Remove voice session
        if chat_id in _voice_sessions:
            del _voice_sessions[chat_id]
            logger.info(f"Stopped voice session for chat {chat_id}")
        else:
            logger.warning(f"No voice session found for chat {chat_id}")

        # Clear accumulated message IDs to prevent stale data
        if chat_id in _voice_message_ids:
            del _voice_message_ids[chat_id]
            logger.info(f"Cleared accumulated message IDs for chat {chat_id}")

        await stop_voice_response(
            StopVoiceResponsePayload(
                success=True, message="Voice session stopped successfully"
            ),
            room=sid,
        )

    except Exception as e:
        logger.error(f"Error in stop_voice for {sid}: {str(e)}", exc_info=True)
        await stop_voice_error(
            StopVoiceErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def stop_voice(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StopVoicePayload(**data)
        await _stop_voice_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in stop_voice for {sid}: {e}")
        await stop_voice_error(
            StopVoiceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


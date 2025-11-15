"""Handler for leave_chat WebSocket event."""

import logging
from typing import Any

from app.main import sio
from app.utils.websocket.remove_active_connection import \
    remove_active_connection
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class LeaveChatErrorPayload(BaseModel):
    success: bool
    message: str


# Pydantic model for client-to-server event
class LeaveChatPayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def leave_chat_error(payload: LeaveChatErrorPayload, room: str) -> None:
    await sio.emit("leave_chat_error", payload.model_dump(), room=room)


async def _leave_chat_impl(sid: str, data: LeaveChatPayload) -> None:
    """Leave a specific chat room"""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = LeaveChatPayload(**data)
        await _leave_chat_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in leave_chat for {sid}: {e}")
        await leave_chat_error(
            LeaveChatErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

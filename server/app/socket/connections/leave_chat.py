"""Handler for leave_chat WebSocket event."""

import logging

from app.main import sio
from app.utils.websocket.remove_active_connection import remove_active_connection
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Pydantic model for client-to-server event
class LeaveChatPayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


@sio.event  # type: ignore
async def leave_chat(sid: str, data: LeaveChatPayload) -> None:
    """Leave a specific chat room"""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

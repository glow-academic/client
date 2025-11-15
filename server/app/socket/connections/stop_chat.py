"""Handler for stop_chat WebSocket event."""

import logging

from app.main import sio
from app.utils.websocket.remove_active_connection import remove_active_connection
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class ChatStoppedPayload(BaseModel):
    chat_id: str
    chat_type: str


# Pydantic model for client-to-server event
class StopChatPayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def chat_stopped(payload: ChatStoppedPayload, room: str) -> None:
    await sio.emit("chat_stopped", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def stop_chat(sid: str, data: StopChatPayload) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        await chat_stopped(
            ChatStoppedPayload(chat_id=str(chat_id), chat_type=chat_type), room=sid
        )
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

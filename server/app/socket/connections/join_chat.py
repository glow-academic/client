"""Handler for join_chat WebSocket event."""

import logging

from app.main import sio
from app.utils.websocket.set_active_connection import set_active_connection
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class JoinedChatPayload(BaseModel):
    chat_id: str
    chat_type: str


# Pydantic model for client-to-server event
class JoinChatPayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def joined_chat(payload: JoinedChatPayload, room: str) -> None:
    await sio.emit("joined_chat", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def join_chat(sid: str, data: JoinChatPayload) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        await set_active_connection(chat_id, sid)
        logger.info(
            f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})"
        )
        await joined_chat(
            JoinedChatPayload(chat_id=chat_id, chat_type=chat_type), room=sid
        )

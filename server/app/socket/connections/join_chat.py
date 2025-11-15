"""Handler for join_chat WebSocket event."""

import logging
from typing import Any

from app.main import sio
from app.utils.websocket_utils import set_active_connection

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def join_chat(sid: str, data: dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        await set_active_connection(chat_id, sid)
        logger.info(
            f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})"
        )
        await sio.emit(
            "joined_chat", {"chat_id": chat_id, "chat_type": chat_type}, room=sid
        )


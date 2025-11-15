"""Handler for leave_chat WebSocket event."""

import logging
from typing import Any

from app.main import sio
from app.socket.connections.utils import remove_active_connection

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


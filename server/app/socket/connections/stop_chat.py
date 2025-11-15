"""Handler for stop_chat WebSocket event."""

import logging
from typing import Any

from app.main import sio
from app.utils.websocket_utils import remove_active_connection

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def stop_chat(sid: str, data: dict[str, Any]) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

    if chat_id:
        await sio.emit(
            "chat_stopped", {"chat_id": str(chat_id), "chat_type": chat_type}, room=sid
        )
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


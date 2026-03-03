"""Attempt leave handler.

Handles: attempt_leave — leave a chat room.
"""

from typing import Any

from app.main import sio
from app.v5.socket.client.types import AttemptLeavePayload
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_leave(sid: str, data: dict[str, Any]) -> None:
    """Leave a chat room."""
    try:
        payload = AttemptLeavePayload(**data)
        chat_id = str(payload.chat_id)
        room_name = f"attempt_{chat_id}"
        await sio.leave_room(sid, room_name)
    except Exception as e:
        logger.exception(f"Error in attempt_leave: {e}")

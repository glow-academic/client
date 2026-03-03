"""Test leave handler.

Handles: test_leave — leave a test room.
"""

from typing import Any

from app.v5.infra.globals import sio
from app.v5.api.socket.client.types import TestLeavePayload
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def test_leave(sid: str, data: dict[str, Any]) -> None:
    """Leave a test room."""
    try:
        payload = TestLeavePayload(**data)
        invocation_id_str = str(payload.invocation_id)
        room_name = f"test_{invocation_id_str}"
        await sio.leave_room(sid, room_name)
    except Exception as e:
        logger.exception(f"Error in test_leave: {e}")

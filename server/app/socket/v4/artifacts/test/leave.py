"""Test leave handler.

Handles WebSocket event:
- test_leave: Leave a test room
"""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.test.types import TestLeavePayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()


@sio.event  # type: ignore
async def test_leave(sid: str, data: dict[str, Any]) -> None:
    """Handle test_leave event - leave a test room."""
    try:
        payload = TestLeavePayload(**data)
        invocation_id_str = str(payload.invocation_id)
        room_name = f"test_{invocation_id_str}"
        await sio.leave_room(sid, room_name)
        logger.info(f"Client {sid} left room {room_name}")
    except Exception as e:
        logger.exception(f"Error in test_leave: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/leave", response_model=dict[str, bool])
async def test_leave_api(request: TestLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave a test room."""
    return {"success": True}

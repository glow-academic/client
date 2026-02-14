"""Attempt leave handler.

Handles WebSocket event:
- attempt_leave: Leave a chat room
"""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.attempt.types import AttemptLeavePayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()


@sio.event  # type: ignore
async def attempt_leave(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_leave event - leave a chat room."""
    try:
        payload = AttemptLeavePayload(**data)
        chat_id = str(payload.chat_id)
        room_name = f"attempt_{chat_id}"

        # Leave the room
        await sio.leave_room(sid, room_name)

        logger.info(f"Client {sid} left room {room_name}")

    except Exception as e:
        logger.exception(f"Error in attempt_leave: {str(e)}")
        # Don't emit error for leave - it's not critical


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/leave", response_model=dict[str, bool])
async def attempt_leave_api(request: AttemptLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave a chat room."""
    return {"success": True}

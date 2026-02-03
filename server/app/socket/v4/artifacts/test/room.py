"""Test room management handler.

Handles WebSocket events for joining/leaving benchmark rooms:
- test_join: Join a benchmark room for real-time updates
- test_leave: Leave a benchmark room
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.socket.v4.artifacts.test.types import (
    TestJoinedEvent,
    TestJoinPayload,
    TestLeavePayload,
    TestErrorEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def test_join(sid: str, data: dict[str, Any]) -> None:
    """Handle test_join event - join a benchmark room."""
    try:
        payload = TestJoinPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    attempt_id=str(payload.attempt_id),
                    message="Profile not found. Please reconnect.",
                    error_type="join",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        attempt_id = str(payload.attempt_id)
        room_name = f"benchmark_{attempt_id}"
        await sio.enter_room(sid, room_name)

        event = TestJoinedEvent(attempt_id=attempt_id, success=True)
        await sio.emit("test_joined", event.model_dump(mode="json"), room=sid)

        logger.info(f"Client {sid} joined room {room_name}")
    except Exception as e:
        logger.exception(f"Error in test_join: {str(e)}")
        attempt_id = data.get("attempt_id", "")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                attempt_id=str(attempt_id) if attempt_id else None,
                message=f"Failed to join room: {str(e)}",
                error_type="join",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_leave(sid: str, data: dict[str, Any]) -> None:
    """Handle test_leave event - leave a benchmark room."""
    try:
        payload = TestLeavePayload(**data)
        attempt_id = str(payload.attempt_id)
        room_name = f"benchmark_{attempt_id}"
        await sio.leave_room(sid, room_name)
        logger.info(f"Client {sid} left room {room_name}")
    except Exception as e:
        logger.exception(f"Error in test_leave: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/join", response_model=dict[str, bool])
async def test_join_api(request: TestJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join a benchmark room for real-time updates."""
    return {"success": True}


@client_router.post("/test/leave", response_model=dict[str, bool])
async def test_leave_api(request: TestLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave a benchmark room."""
    return {"success": True}


@server_router.post("/test/joined", response_model=dict[str, bool])
async def test_joined_api(request: TestJoinedEvent) -> dict[str, bool]:
    """Server-to-client event: Successfully joined a benchmark room."""
    return {"success": True}

"""Test join handler.

Handles WebSocket event:
- test_join: Join a test room for real-time updates
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.socket.v4.artifacts.test.types import (
    TestErrorEvent,
    TestJoinedEvent,
    TestJoinPayload,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def test_join(sid: str, data: dict[str, Any]) -> None:
    """Handle test_join event - join a test room."""
    try:
        payload = TestJoinPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    invocation_id=str(payload.invocation_id),
                    message="Profile not found. Please reconnect.",
                    error_type="join",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        invocation_id_str = str(payload.invocation_id)
        room_name = f"test_{invocation_id_str}"
        await sio.enter_room(sid, room_name)

        event = TestJoinedEvent(invocation_id=invocation_id_str, success=True)
        await sio.emit("test_joined", event.model_dump(mode="json"), room=sid)

        logger.info(f"Client {sid} joined room {room_name}")
    except Exception as e:
        logger.exception(f"Error in test_join: {str(e)}")
        invocation_id = data.get("invocation_id", "")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                invocation_id=str(invocation_id) if invocation_id else None,
                message=f"Failed to join room: {str(e)}",
                error_type="join",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/join", response_model=dict[str, bool])
async def test_join_api(request: TestJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join a test room for real-time updates."""
    return {"success": True}


@server_router.post("/test/joined", response_model=dict[str, bool])
async def test_joined_api(request: TestJoinedEvent) -> dict[str, bool]:
    """Server-to-client event: Successfully joined a test room."""
    return {"success": True}

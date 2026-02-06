"""Test control handler.

Handles WebSocket events for stopping benchmark tests:
- test_stop: Stop current benchmark test
"""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.test.types import TestErrorEvent, TestStopPayload, TestStoppedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


async def _test_stop_impl(sid: str, data: TestStopPayload) -> None:
    """Handle test_stop - signal to stop current test execution."""
    chat_id_str = str(data.chat_id)

    try:
        # For now, just emit stopped event
        # TODO: Add actual cancellation logic via run cancellation tokens
        await sio.emit(
            "test_stopped",
            TestStoppedEvent(
                chat_id=chat_id_str,
                success=True,
                message="Test execution stopped",
            ).model_dump(mode="json"),
            room=sid,
        )
        await sio.emit(
            "test_stopped",
            TestStoppedEvent(
                chat_id=chat_id_str,
                success=True,
                message="Test execution stopped",
            ).model_dump(mode="json"),
            room=f"test_{chat_id_str}",
        )

        logger.info(f"Test stopped - chat_id={chat_id_str}")

    except Exception as e:
        logger.exception(f"Failed to stop test: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=chat_id_str,
                message=f"Failed to stop test: {str(e)}",
                error_type="stop",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle test_stop event."""
    try:
        payload = TestStopPayload(**data)
        await _test_stop_impl(sid, payload)
    except Exception as e:
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=str(data.get("chat_id", "")),
                message=f"Invalid request: {str(e)}",
                error_type="stop",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/stop", response_model=dict[str, bool])
async def test_stop_api(request: TestStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop current benchmark test."""
    return {"success": True}


@server_router.post("/test/stopped", response_model=dict[str, bool])
async def test_stopped_api(request: TestStoppedEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark test stopped."""
    return {"success": True}

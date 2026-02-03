"""Test send handler (placeholder for future manual test interactions)."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.test.types import TestErrorEvent, TestSendPayload

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def test_send(sid: str, data: dict[str, Any]) -> None:
    """Handle test_send event (not yet implemented)."""
    try:
        payload = TestSendPayload(**data)
        await sio.emit(
            "test_error",
            TestErrorEvent(
                attempt_id=str(payload.attempt_id),
                message="test_send is not implemented",
                error_type="send",
            ).model_dump(mode="json"),
            room=sid,
        )
    except Exception as e:
        await sio.emit(
            "test_error",
            TestErrorEvent(
                attempt_id=data.get("attempt_id"),
                message=f"Invalid request: {str(e)}",
                error_type="send",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/send", response_model=dict[str, bool])
async def test_send_api(request: TestSendPayload) -> dict[str, bool]:
    """Client-to-server event: Send test input (future)."""
    return {"success": True}

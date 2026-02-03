"""Test complete handler.

Listens to benchmark end events and emits test_complete to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import TestCompleteEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("benchmark_end")  # type: ignore
async def handle_test_complete(data: dict[str, Any]) -> None:
    """Handle benchmark_end events and emit test_complete."""
    attempt_id = data.get("attempt_id")
    test_id = data.get("test_id")
    if not attempt_id:
        return

    event = TestCompleteEvent(
        attempt_id=str(attempt_id),
        test_id=str(test_id) if test_id else None,
        success=True,
        message="Test completed",
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_complete", event.model_dump(mode="json"), room=sid)

    await sio.emit(
        "test_complete",
        event.model_dump(mode="json"),
        room=f"benchmark_{attempt_id}",
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/complete", response_model=dict[str, bool])
async def test_complete_api(request: TestCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Test completed."""
    return {"success": True}

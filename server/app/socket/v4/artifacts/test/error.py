"""Test error handler.

Listens to benchmark_error events and emits test_error to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import TestErrorEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("benchmark_error")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    """Handle benchmark_error events and emit test_error."""
    attempt_id = data.get("attempt_id")
    test_id = data.get("test_id")
    message = data.get("error_message") or data.get("message", "Test error")

    event = TestErrorEvent(
        attempt_id=str(attempt_id) if attempt_id else None,
        test_id=str(test_id) if test_id else None,
        message=message,
        error_type=data.get("error_type"),
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_error", event.model_dump(mode="json"), room=sid)

    if attempt_id:
        await sio.emit(
            "test_error",
            event.model_dump(mode="json"),
            room=f"benchmark_{attempt_id}",
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/error", response_model=dict[str, bool])
async def test_error_api(request: TestErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Test error occurred."""
    return {"success": True}

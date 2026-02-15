"""Test error handler.

Handles test error events and emits test_error to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import TestErrorEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_error_event")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    """Handle test error events and emit test_error."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    run_id = data.get("run_id")
    message = data.get("error_message") or data.get("message", "Test error")

    event = TestErrorEvent(
        invocation_id=str(invocation_id) if invocation_id else None,
        run_id=str(run_id) if run_id else None,
        message=message,
        error_type=data.get("error_type"),
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_error", event.model_dump(mode="json"), room=sid)

    if invocation_id:
        await sio.emit(
            "test_error",
            event.model_dump(mode="json"),
            room=f"test_{invocation_id}",
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/error", response_model=dict[str, bool])
async def test_error_api(request: TestErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Test error occurred."""
    return {"success": True}

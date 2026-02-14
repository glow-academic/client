"""Test error handler.

Handles test error events and emits test_error to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.test.types import TestErrorEvent
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_error_event")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    """Handle test error events and emit test_error."""
    chat_id = data.get("chat_id")
    run_id = data.get("run_id")
    message = data.get("error_message") or data.get("message", "Test error")

    event = TestErrorEvent(
        chat_id=str(chat_id) if chat_id else None,
        run_id=str(run_id) if run_id else None,
        message=message,
        error_type=data.get("error_type"),
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_error", event.model_dump(mode="json"), room=sid)

    if chat_id:
        await sio.emit(
            "test_error",
            event.model_dump(mode="json"),
            room=f"test_{chat_id}",
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/error", response_model=dict[str, bool])
async def test_error_api(request: TestErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Test error occurred."""
    return {"success": True}

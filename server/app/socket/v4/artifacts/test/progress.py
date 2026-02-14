"""Test progress handler.

Handles test progress events and emits test_progress to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.socket.v4.artifacts.test.types import TestProgressEvent
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_progress_update")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    """Handle test progress update events and emit test_progress."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return

    chat_id_str = str(chat_id)

    event = TestProgressEvent(
        chat_id=chat_id_str,
        type=data.get("type", "progress"),
        run_id=data.get("run_id"),
        current_run=data.get("current_run"),
        total_runs=data.get("total_runs"),
        message=data.get("message"),
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_progress", event.model_dump(mode="json"), room=sid)

    await sio.emit(
        "test_progress",
        event.model_dump(mode="json"),
        room=f"test_{chat_id_str}",
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/progress", response_model=dict[str, bool])
async def test_progress_api(request: TestProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Test progress update."""
    return {"success": True}

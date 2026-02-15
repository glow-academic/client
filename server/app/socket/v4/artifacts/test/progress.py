"""Test progress handler.

Handles test progress events and emits test_progress to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import TestProgressEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_progress_update")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    """Handle test progress update events and emit test_progress."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not invocation_id:
        return

    invocation_id_str = str(invocation_id)

    event = TestProgressEvent(
        invocation_id=invocation_id_str,
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
        room=f"test_{invocation_id_str}",
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/progress", response_model=dict[str, bool])
async def test_progress_api(request: TestProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Test progress update."""
    return {"success": True}

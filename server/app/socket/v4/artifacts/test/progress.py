"""Test progress handler.

Listens to benchmark advance events and emits test_progress to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import TestProgressEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("benchmark_advance")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    """Handle benchmark_advance events and emit test_progress."""
    attempt_id = data.get("attempt_id")
    test_id = data.get("test_id")
    if not attempt_id:
        return

    event = TestProgressEvent(
        attempt_id=str(attempt_id),
        test_id=str(test_id) if test_id else None,
        run_id=data.get("run_id"),
        group_id=data.get("group_id"),
        status="advanced",
        message="Test advanced",
    )

    sid = data.get("sid")
    if sid:
        await sio.emit("test_progress", event.model_dump(mode="json"), room=sid)

    await sio.emit(
        "test_progress",
        event.model_dump(mode="json"),
        room=f"benchmark_{attempt_id}",
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/progress", response_model=dict[str, bool])
async def test_progress_api(request: TestProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Test progress update."""
    return {"success": True}

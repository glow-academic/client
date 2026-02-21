"""Server handler: test_grade_start."""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import TestProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_grade_start")  # type: ignore
async def test_grade_start_server_handler(data: dict[str, Any]) -> None:
    """Emit test_progress_update to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestProgressEvent(
        invocation_id=data.get("invocation_id", ""),
        type=data.get("progress_type", "progress"),
        run_id=data.get("run_id"),
        current_run=data.get("current_run"),
        total_runs=data.get("total_runs"),
        message=data.get("message"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_progress_update", event.model_dump(mode="json"), room=room)

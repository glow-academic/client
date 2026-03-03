"""Server handler: test_run_start."""

from typing import Any

from app.main import get_internal_sio, sio
from app.v5.socket.client.types import TestRunStartEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_run_start")  # type: ignore
async def test_run_start_server_handler(data: dict[str, Any]) -> None:
    """Emit test_run_start to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestRunStartEvent(
        invocation_id=data.get("invocation_id", ""),
        run_id=data.get("run_id", ""),
        original_run_resource_id=data.get("original_run_resource_id"),
        current_run=data.get("current_run", 1),
        total_runs=data.get("total_runs", 1),
        created_at=data.get("created_at", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_run_start", event.model_dump(mode="json"), room=room)

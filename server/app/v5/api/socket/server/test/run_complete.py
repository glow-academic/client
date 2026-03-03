"""Server handler: test_run_complete."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import TestRunCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_run_complete")  # type: ignore
async def test_run_complete_server_handler(data: dict[str, Any]) -> None:
    """Emit test_run_complete to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestRunCompleteEvent(
        invocation_id=data.get("invocation_id", ""),
        run_id=data.get("run_id", ""),
        original_run_resource_id=data.get("original_run_resource_id"),
        tool_calls=data.get("tool_calls"),
        current_run=data.get("current_run", 1),
        total_runs=data.get("total_runs", 1),
        remaining_runs=data.get("remaining_runs", 0),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_run_complete", event.model_dump(mode="json"), room=room)

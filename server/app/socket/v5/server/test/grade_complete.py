"""Server handler: test_grade_complete."""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import TestAllCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_grade_complete")  # type: ignore
async def test_grade_complete_server_handler(data: dict[str, Any]) -> None:
    """Emit test_all_complete to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestAllCompleteEvent(
        invocation_id=data.get("invocation_id", ""),
        total_runs=data.get("total_runs", 0),
        success=data.get("success", True),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_all_complete", event.model_dump(mode="json"), room=room)

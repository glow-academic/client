"""Server handler: test_grade_progress."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.socket.v5.client.types import TestGradedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_grade_progress")  # type: ignore
async def test_graded_server_handler(data: dict[str, Any]) -> None:
    """Emit test_graded to client rooms."""
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    if not rooms:
        return
    event = TestGradedEvent(
        invocation_id=data.get("invocation_id", ""),
        grade_id=data.get("grade_id"),
        score=data.get("score"),
        passed=data.get("passed"),
        feedback=data.get("feedback"),
    )
    for room in rooms:
        await sio.emit("test_graded", event.model_dump(mode="json"), room=room)

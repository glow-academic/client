"""Server handler: test_grade_progress."""

from typing import Any

from app.v5.infra.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import TestGradedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_grade_progress")  # type: ignore
async def test_graded_server_handler(data: dict[str, Any]) -> None:
    """Emit test_graded to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestGradedEvent(
        invocation_id=data.get("invocation_id", ""),
        grade_id=data.get("grade_id"),
        score=data.get("score"),
        passed=data.get("passed"),
        feedback=data.get("feedback"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_graded", event.model_dump(mode="json"), room=room)

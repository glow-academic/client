"""Server handler: attempt_grade_start."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import AttemptGradeStartEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade_start")  # type: ignore
async def attempt_grade_start_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_grade_start to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptGradeStartEvent(
        chat_id=data.get("chat_id", ""),
        grade_id=data.get("grade_id"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_grade_start", event.model_dump(mode="json"), room=room)

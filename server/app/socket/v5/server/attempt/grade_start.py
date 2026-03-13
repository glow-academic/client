"""Server handler: attempt_grade_start."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.socket.v5.client.types import AttemptGradeStartEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade_start")  # type: ignore
async def attempt_grade_start_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_grade_start to client rooms."""
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    if not rooms:
        return
    event = AttemptGradeStartEvent(
        chat_id=data.get("chat_id", ""),
        grade_id=data.get("grade_id"),
    )
    for room in rooms:
        await sio.emit("attempt_grade_start", event.model_dump(mode="json"), room=room)

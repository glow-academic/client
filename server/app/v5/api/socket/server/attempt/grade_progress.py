"""Server handler: attempt_grade_progress."""

from typing import Any

from app.v5.infra.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptGradeProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade_progress")  # type: ignore
async def attempt_grade_progress_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_grade_progress to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptGradeProgressEvent(
        chat_id=data.get("chat_id", ""),
        grade_id=data.get("grade_id"),
        resource_type=data.get("resource_type"),
        entry=data.get("entry"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_grade_progress", event.model_dump(mode="json"), room=room
        )

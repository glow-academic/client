"""Server handler: attempt_grade_complete."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptGradeCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade_complete")  # type: ignore
async def attempt_grade_complete_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_grade_complete to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptGradeCompleteEvent(
        chat_id=data.get("chat_id", ""),
        grade_id=data.get("grade_id"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_grade_complete", event.model_dump(mode="json"), room=room
        )

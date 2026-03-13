"""Server handler: attempt_grade_complete."""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, sio
from app.socket.v5.client.types import AttemptGradeCompleteEvent
from app.socket.v5.server.shared import publish_live_socket_event

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade_complete")  # type: ignore
async def attempt_grade_complete_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_grade_complete to client rooms and SSE subscribers."""
    event = AttemptGradeCompleteEvent(
        chat_id=data.get("chat_id", ""),
        grade_id=data.get("grade_id"),
    )

    attempt_id = data.get("attempt_id")
    await publish_live_socket_event(
        public_event_type="artifacts.attempt.grade.complete",
        artifact="attempt",
        operation="grade",
        payload=event.model_dump(mode="json"),
        entity_id=UUID(str(attempt_id)) if attempt_id else None,
    )

    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit(
            "attempt_grade_complete", event.model_dump(mode="json"), room=room
        )

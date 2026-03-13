"""Server handler: attempt_assistant_progress."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.socket.v5.client.types import AttemptAssistantProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_assistant_progress")  # type: ignore
async def attempt_assistant_progress_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_assistant_progress to client rooms."""
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    if not rooms:
        return
    event = AttemptAssistantProgressEvent(
        chat_id=data.get("chat_id", ""),
        content_type=data.get("content_type", "delta"),
        content=data.get("content"),
        audio=data.get("audio"),
    )
    for room in rooms:
        await sio.emit(
            "attempt_assistant_progress", event.model_dump(mode="json"), room=room
        )

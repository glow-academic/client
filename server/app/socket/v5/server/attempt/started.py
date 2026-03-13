"""Server handler: attempt_started."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.socket.v5.client.types import AttemptStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_started")  # type: ignore
async def attempt_started_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_started to client rooms."""
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    if not rooms:
        return
    event = AttemptStartedEvent(
        attempt_id=data.get("attempt_id", ""),
        chat_entry_id=data.get("chat_entry_id", ""),
    )
    for room in rooms:
        await sio.emit("attempt_started", event.model_dump(mode="json"), room=room)

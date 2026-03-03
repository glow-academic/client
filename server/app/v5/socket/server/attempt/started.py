"""Server handler: attempt_started."""

from typing import Any

from app.main import get_internal_sio, sio
from app.v5.socket.client.types import AttemptStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_started")  # type: ignore
async def attempt_started_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_started to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptStartedEvent(
        attempt_id=data.get("attempt_id", ""),
        chat_entry_id=data.get("chat_entry_id", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_started", event.model_dump(mode="json"), room=room)

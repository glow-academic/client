"""Server handler: attempt_joined."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import AttemptJoinedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_joined")  # type: ignore
async def attempt_joined_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_joined to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptJoinedEvent(
        chat_id=data.get("chat_id", ""),
        success=data.get("success", True),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_joined", event.model_dump(mode="json"), room=room)

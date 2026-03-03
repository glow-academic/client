"""Server handler: attempt_stopped."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptStoppedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_stopped")  # type: ignore
async def attempt_stopped_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_stopped to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptStoppedEvent(
        chat_id=data.get("chat_id", ""),
        success=data.get("success", False),
        message=data.get("message"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_stopped", event.model_dump(mode="json"), room=room)

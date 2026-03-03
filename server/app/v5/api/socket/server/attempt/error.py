"""Server handler: attempt_error."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_error")  # type: ignore
async def attempt_error_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_error to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptErrorEvent(
        type=data.get("error_type", "unknown"),
        message=data.get("message", "Unknown error"),
        chat_id=data.get("chat_id"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_error", event.model_dump(mode="json"), room=room)

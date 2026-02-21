"""Server handler for attempt errors from ALL sources.

Listens to internal `attempt_progress` and emits to client:
- type=error -> attempt_error

Note: `error_type` in the internal payload maps to `type` in AttemptErrorEvent
(the client model uses `type` for the error category).
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_progress")  # type: ignore
async def attempt_error_server_handler(data: dict[str, Any]) -> None:
    """Route error attempt_progress events to clients."""
    if data.get("type") != "error":
        return

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

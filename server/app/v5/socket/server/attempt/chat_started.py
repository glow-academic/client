"""Server handler: attempt_chat_started."""

from typing import Any

from app.main import get_internal_sio, sio
from app.v5.socket.client.types import AttemptChatStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_chat_started")  # type: ignore
async def attempt_chat_started_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_chat_started to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptChatStartedEvent(
        attempt_id=data.get("attempt_id", ""),
        chat_id=data.get("chat_id", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_chat_started", event.model_dump(mode="json"), room=room)

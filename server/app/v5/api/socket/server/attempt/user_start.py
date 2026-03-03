"""Server handler: attempt_user_start."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptUserStartEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_user_start")  # type: ignore
async def attempt_user_start_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_user_start to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptUserStartEvent(
        chat_id=data.get("chat_id", ""),
        message_id=data.get("message_id", ""),
        created_at=data.get("created_at", ""),
        item_id=data.get("item_id"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_user_start", event.model_dump(mode="json"), room=room)

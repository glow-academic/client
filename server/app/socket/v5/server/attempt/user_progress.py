"""Server handler: attempt_user_progress."""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptUserProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_user_progress")  # type: ignore
async def attempt_user_progress_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_user_progress to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptUserProgressEvent(
        chat_id=data.get("chat_id", ""),
        item_id=data.get("item_id"),
        transcript=data.get("transcript", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_user_progress", event.model_dump(mode="json"), room=room
        )

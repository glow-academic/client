"""Server handler: attempt_chat_ended."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptChatEndedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_chat_ended")  # type: ignore
async def attempt_chat_ended_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_chat_ended to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptChatEndedEvent(
        chat_id=data.get("chat_id", ""),
        is_attempt_finished=data.get("is_attempt_finished"),
        grade_id=data.get("grade_id"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_chat_ended", event.model_dump(mode="json"), room=room)

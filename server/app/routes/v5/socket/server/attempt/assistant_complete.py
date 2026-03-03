"""Server handler: attempt_assistant_complete."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptAssistantCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_assistant_complete")  # type: ignore
async def attempt_assistant_complete_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_assistant_complete to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptAssistantCompleteEvent(
        chat_id=data.get("chat_id", ""),
        message_id=data.get("message_id", ""),
        content=data.get("content"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_assistant_complete", event.model_dump(mode="json"), room=room
        )

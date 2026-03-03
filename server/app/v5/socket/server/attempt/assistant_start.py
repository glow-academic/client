"""Server handler: attempt_assistant_start."""

from typing import Any

from app.main import get_internal_sio, sio
from app.v5.socket.client.types import AttemptAssistantStartEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_assistant_start")  # type: ignore
async def attempt_assistant_start_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_assistant_start to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptAssistantStartEvent(
        chat_id=data.get("chat_id", ""),
        message_id=data.get("message_id", ""),
        created_at=data.get("created_at", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_assistant_start", event.model_dump(mode="json"), room=room
        )

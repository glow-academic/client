"""Server handler for attempt lifecycle start signals.

Listens to internal `attempt_progress` and emits to client:
- type=started  -> attempt_started
- type=chat_started -> attempt_chat_started
- type=joined   -> attempt_joined
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    AttemptChatStartedEvent,
    AttemptJoinedEvent,
    AttemptStartedEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_progress")  # type: ignore
async def attempt_start_server_handler(data: dict[str, Any]) -> None:
    """Route start-related attempt_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("started", "chat_started", "joined"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]

    if event_type == "started":
        event = AttemptStartedEvent(
            attempt_id=data.get("attempt_id", ""),
            training_entry_id=data.get("training_entry_id", ""),
        )
        for room in rooms:
            await sio.emit("attempt_started", event.model_dump(mode="json"), room=room)

    elif event_type == "chat_started":
        event = AttemptChatStartedEvent(
            attempt_id=data.get("attempt_id", ""),
            chat_id=data.get("chat_id", ""),
        )
        for room in rooms:
            await sio.emit(
                "attempt_chat_started", event.model_dump(mode="json"), room=room
            )

    elif event_type == "joined":
        event = AttemptJoinedEvent(
            chat_id=data.get("chat_id", ""),
            success=data.get("success", True),
        )
        for room in rooms:
            await sio.emit(
                "attempt_joined", event.model_dump(mode="json"), room=room
            )

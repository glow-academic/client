"""Server handler for attempt lifecycle start signals.

Listens to internal `attempt_progress` and emits to client:
- type=started  -> attempt_started
- type=chat_started -> attempt_chat_started
- type=joined   -> attempt_joined
- type=ready    -> attempt_audio_ready
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    AttemptAudioReadyEvent,
    AttemptChatStartedEvent,
    AttemptJoinedEvent,
    AttemptStartedEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_progress")  # type: ignore
async def attempt_start_server_handler(data: dict[str, Any]) -> None:
    """Route start-related attempt_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("started", "chat_started", "joined", "ready"):
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
        chat_started_event = AttemptChatStartedEvent(
            attempt_id=data.get("attempt_id", ""),
            chat_id=data.get("chat_id", ""),
        )
        for room in rooms:
            await sio.emit(
                "attempt_chat_started",
                chat_started_event.model_dump(mode="json"),
                room=room,
            )

    elif event_type == "joined":
        joined_event = AttemptJoinedEvent(
            chat_id=data.get("chat_id", ""),
            success=data.get("success", True),
        )
        for room in rooms:
            await sio.emit(
                "attempt_joined", joined_event.model_dump(mode="json"), room=room
            )

    elif event_type == "ready":
        ready_event = AttemptAudioReadyEvent(
            chat_id=data.get("chat_id", ""),
            success=data.get("success", True),
            message=data.get("message"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_audio_ready",
                ready_event.model_dump(mode="json"),
                room=room,
            )

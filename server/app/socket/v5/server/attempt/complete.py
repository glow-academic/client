"""Server handler for attempt lifecycle completion signals.

Listens to internal `attempt_progress` and emits to client:
- type=ended        -> attempt_ended
- type=chat_ended   -> attempt_chat_ended
- type=stopped      -> attempt_stopped
- type=audio_ended  -> attempt_audio_ended
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    AttemptAudioEndedEvent,
    AttemptChatEndedEvent,
    AttemptEndedEvent,
    AttemptStoppedEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_progress")  # type: ignore
async def attempt_complete_server_handler(data: dict[str, Any]) -> None:
    """Route completion-related attempt_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("ended", "chat_ended", "stopped", "audio_ended"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]

    if event_type == "ended":
        event = AttemptEndedEvent(
            attempt_id=data.get("attempt_id", ""),
            success=data.get("success", False),
            all_scenarios_complete=data.get("all_scenarios_complete", False),
            message=data.get("message"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_ended", event.model_dump(mode="json"), room=room
            )

    elif event_type == "chat_ended":
        chat_ended_event = AttemptChatEndedEvent(
            chat_id=data.get("chat_id", ""),
            is_attempt_finished=data.get("is_attempt_finished"),
            grade_id=data.get("grade_id"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_chat_ended",
                chat_ended_event.model_dump(mode="json"),
                room=room,
            )

    elif event_type == "stopped":
        stopped_event = AttemptStoppedEvent(
            chat_id=data.get("chat_id", ""),
            success=data.get("success", False),
            message=data.get("message"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_stopped",
                stopped_event.model_dump(mode="json"),
                room=room,
            )

    elif event_type == "audio_ended":
        audio_ended_event = AttemptAudioEndedEvent(
            chat_id=data.get("chat_id", ""),
            success=data.get("success", True),
            message=data.get("message"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_audio_ended",
                audio_ended_event.model_dump(mode="json"),
                room=room,
            )

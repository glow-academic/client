"""Server handler for mid-flow attempt progress updates.

Listens to internal `attempt_progress` and emits to client:
- type=user_complete    -> attempt_user_complete
- type=assistant_start  -> attempt_assistant_start
- type=response_result  -> attempt_response_result
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    AttemptAssistantStartEvent,
    AttemptResponseResultEvent,
    AttemptUserCompleteEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_progress")  # type: ignore
async def attempt_progress_server_handler(data: dict[str, Any]) -> None:
    """Route progress-related attempt_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("user_complete", "assistant_start", "response_result"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]

    if event_type == "user_complete":
        event = AttemptUserCompleteEvent(
            chat_id=data.get("chat_id", ""),
            message_id=data.get("message_id", ""),
            content=data.get("content", ""),
            created_at=data.get("created_at", ""),
        )
        for room in rooms:
            await sio.emit(
                "attempt_user_complete", event.model_dump(mode="json"), room=room
            )

    elif event_type == "assistant_start":
        event = AttemptAssistantStartEvent(
            chat_id=data.get("chat_id", ""),
            message_id=data.get("message_id", ""),
            created_at=data.get("created_at", ""),
        )
        for room in rooms:
            await sio.emit(
                "attempt_assistant_start", event.model_dump(mode="json"), room=room
            )

    elif event_type == "response_result":
        event = AttemptResponseResultEvent(
            success=data.get("success", False),
            message=data.get("message"),
            is_correct=data.get("is_correct"),
        )
        for room in rooms:
            await sio.emit(
                "attempt_response_result", event.model_dump(mode="json"), room=room
            )

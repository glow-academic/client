"""Attempt audio error handler.

Handles internal event:
- generate_audio_error: Translate to attempt_error
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.infra.v4.websocket.attempt.audio_helpers import get_session_for_group
from app.socket.v4.artifacts.attempt.types import AttemptUnifiedErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_error")  # type: ignore
async def handle_generate_audio_error(data: dict[str, Any]) -> None:
    """Handle generate_audio_error - translate to attempt_error.

    BFF Translation: group_id from internal event -> chat_id for client event.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    error_message = data.get("error_message", "Unknown audio error")

    await sio.emit(
        "attempt_error",
        AttemptUnifiedErrorEvent(
            group_id=group_id,
            type="audio",
            message=error_message,
        ).model_dump(mode="json"),
        room=session.sid,
    )

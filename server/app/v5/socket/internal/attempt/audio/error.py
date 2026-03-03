"""Internal handler: generate_audio_error → attempt_progress(type=error).

Translates audio adapter errors into the unified attempt_progress error format.
"""

from typing import Any

from app.infra.websocket.session_store import get_session_by_group_id
from app.globals import get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptErrorData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_error")  # type: ignore
async def handle_audio_error(data: dict[str, Any]) -> None:
    """Translate generate_audio_error → attempt_progress(type=error)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    await internal_sio.emit(
        "attempt_error",
        AttemptErrorData(
            sid=session.sid,
            error_type="audio",
            message=data.get("error_message", "Unknown audio error"),
            chat_id=session.chat_id,
        ).model_dump(mode="json"),
    )

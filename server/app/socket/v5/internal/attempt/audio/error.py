"""Internal handler: generate_audio_error → attempt_progress(type=error).

Translates audio adapter errors into the unified attempt_progress error format.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio

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
        {
            "sid": session.sid,
            "error_type": "audio",
            "message": data.get("error_message", "Unknown audio error"),
            "chat_id": session.chat_id,
        },
    )

"""Internal handler: generate_audio_progress → attempt_assistant_progress(content_type=audio).

Resolves chat_id from session and passes raw audio bytes through.
"""

from typing import Any

from app.infra.websocket.session_store import get_session_by_group_id
from app.globals import get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptAssistantProgressData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_progress")  # type: ignore
async def handle_audio_progress(data: dict[str, Any]) -> None:
    """Translate generate_audio_progress → attempt_assistant_progress(content_type=audio)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    audio_data = data.get("audio")
    if not audio_data:
        return
    await internal_sio.emit(
        "attempt_assistant_progress",
        AttemptAssistantProgressData(
            sid=session.sid,
            chat_id=session.chat_id,
            content_type="audio",
            audio=audio_data,
        ).model_dump(mode="json"),
    )

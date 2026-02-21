"""Internal handler: generate_audio_start → attempt_progress(type=ready).

Resolves chat_id from session and signals the client that the voice session is ready.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptAudioReadyData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_start")  # type: ignore
async def handle_audio_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_start → attempt_progress(type=ready)."""
    group_id = data.get("group_id")
    sid = data.get("sid")
    if not sid or not group_id:
        return
    session = get_session_by_group_id(group_id)
    chat_id = session.chat_id if session else group_id
    await internal_sio.emit(
        "attempt_audio_ready",
        AttemptAudioReadyData(
            sid=sid,
            chat_id=chat_id,
            success=True,
            message="Voice session ready",
        ).model_dump(mode="json"),
    )

"""Internal handler: generate_audio_user_speech_delta → attempt_progress(type=user_delta).

Streams user speech transcription increments.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_delta")  # type: ignore
async def handle_user_speech_delta(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_delta → attempt_progress(type=user_delta)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "user_delta",
            "sid": session.sid,
            "chat_id": session.chat_id,
            "item_id": item_id,
            "transcript": data.get("transcript", ""),
        },
    )

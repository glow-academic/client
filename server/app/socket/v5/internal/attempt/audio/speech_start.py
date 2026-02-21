"""Internal handler: generate_audio_user_speech_start → attempt_progress(type=user_start).

Signals that VAD detected the user speaking.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_start")  # type: ignore
async def handle_user_speech_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_start → attempt_progress(type=user_start)."""
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
            "type": "user_start",
            "sid": session.sid,
            "chat_id": session.chat_id,
            "item_id": item_id,
        },
    )

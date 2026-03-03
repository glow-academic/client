"""Internal handler: generate_audio_user_speech_delta → attempt_user_received_progress.

Streams user speech transcription increments through the shared internal handler.
"""

from typing import Any

from app.infra.websocket.session_store import get_session_by_group_id
from app.globals import get_internal_sio
from app.v5.api.socket.internal.attempt.types import AttemptUserReceivedProgressData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_delta")  # type: ignore
async def handle_user_speech_delta(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_delta → attempt_user_received_progress."""
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
        "attempt_user_received_progress",
        AttemptUserReceivedProgressData(
            sid=session.sid,
            chat_id=session.chat_id,
            item_id=item_id,
            transcript=data.get("transcript", ""),
        ).model_dump(mode="json"),
    )

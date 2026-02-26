"""Internal handler: generate_audio_user_speech_complete → attempt_user_received_complete.

User speech finalized — emit received_complete so the shared internal
handler writes content and marks the message complete.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptUserReceivedCompleteData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_complete")  # type: ignore
async def handle_user_speech_complete(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_complete → attempt_user_received_complete."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return

    transcript = data.get("transcript", "")
    if not transcript or not transcript.strip():
        return

    await internal_sio.emit(
        "attempt_user_received_complete",
        AttemptUserReceivedCompleteData(
            sid=session.sid,
            chat_id=session.chat_id,
            run_id=session.run_id,
            content=transcript.strip(),
            item_id=data.get("item_id"),
        ).model_dump(mode="json"),
    )

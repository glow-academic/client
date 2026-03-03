"""Internal handler: generate_audio_user_speech_complete → attempt_user_received_complete.

User speech finalized — save audio to disk (if present), create upload record,
then emit received_complete so the shared internal handler writes content and
marks the message complete.
"""

import uuid
from typing import Any

from app.infra.websocket.session_store import get_session_by_group_id
from app.globals import AUDIO_FOLDER, get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptUserReceivedCompleteData
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_INSERT_UPLOAD = "uploads/insert_upload_complete.sql"


async def _save_user_speech_audio(audio: bytes) -> str | None:
    """Save raw PCM16 audio to disk and create an upload record.

    Returns the upload_id (str) or None on failure.
    """
    if not audio:
        return None

    try:
        from app.infra.websocket.get_db_connection import get_db_connection

        # Write PCM16 bytes to disk as .wav-compatible raw audio
        file_uuid = uuid.uuid4()
        filename = f"{file_uuid}.pcm16"
        file_path = AUDIO_FOLDER / filename
        file_path.write_bytes(audio)

        # Create upload record in DB
        relative_path = f"audio/{filename}"
        insert_sql = load_sql(SQL_PATH_INSERT_UPLOAD)
        async with get_db_connection() as conn:
            row = await conn.fetchrow(
                insert_sql, relative_path, "audio/pcm16", len(audio)
            )
            if row:
                return str(row["id"])
    except Exception as e:
        logger.exception(f"Failed to save user speech audio: {e}")
    return None


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

    # Save buffered audio if present
    audio: bytes | None = data.get("audio")
    audio_upload_id: str | None = None
    if audio:
        audio_upload_id = await _save_user_speech_audio(audio)

    await internal_sio.emit(
        "attempt_user_received_complete",
        AttemptUserReceivedCompleteData(
            sid=session.sid,
            chat_id=session.chat_id,
            run_id=session.run_id,
            content=transcript.strip(),
            item_id=data.get("item_id"),
            audio_upload_id=audio_upload_id,
        ).model_dump(mode="json"),
    )

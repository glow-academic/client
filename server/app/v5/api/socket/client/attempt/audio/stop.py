"""Client-facing attempt_audio_stop handler.

Records conversation completion in DB and emits generate_audio_session_complete
to the internal layer. Cleanup is handled by the internal handler.
"""

import uuid as uuid_mod
from typing import Any

from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.v5.infra.websocket.session_store import get_session_by_chat_id
from app.globals import get_internal_sio, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_audio_stop(sid: str, data: dict[str, Any]) -> None:
    """Record completion and emit generate_audio_session_complete."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    session = get_session_by_chat_id(chat_id)
    if not session:
        return

    group_id = session.group_id

    # Record conversation completion in DB
    if session.conversation_id:
        try:
            async with get_db_connection() as conn:
                await conn.execute(
                    """INSERT INTO conversations_completions_entry (conversation_id, end_reason)
                    VALUES ($1, $2)""",
                    uuid_mod.UUID(session.conversation_id),
                    data.get("end_reason", "user_stopped"),
                )
        except Exception as e:
            logger.warning(f"Failed to record conversation completion: {e}")

    await internal_sio.emit(
        "generate_audio_session_complete",
        {
            "group_id": group_id,
            "sid": sid,
        },
    )

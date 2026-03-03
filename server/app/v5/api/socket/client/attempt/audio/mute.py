"""Client-facing attempt_audio_mute handler.

Pushes mute control messages into the session's inbound queue
and records the mute event in the database.
"""

import uuid as uuid_mod
from typing import Any

from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.v5.infra.websocket.session_store import get_session_by_chat_id
from app.globals import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_audio_mute(sid: str, data: dict[str, Any]) -> None:
    """Push mute control message into session inbound queue and record in DB."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    session = get_session_by_chat_id(chat_id)
    if not session:
        return

    muted = data.get("muted", False)

    # Record mute event in DB
    if session.conversation_id:
        try:
            async with get_db_connection() as conn:
                await conn.execute(
                    """INSERT INTO mutes_entry (conversation_id, muted)
                    VALUES ($1, $2)""",
                    uuid_mod.UUID(session.conversation_id),
                    muted,
                )
        except Exception as e:
            logger.warning(f"Failed to record mute event: {e}")

    await session.inbound_queue.put({"type": "mic.set_muted", "muted": muted})

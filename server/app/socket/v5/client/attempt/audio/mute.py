"""Client-facing attempt_audio_mute handler.

Pushes mute control messages into the session's inbound queue
and records the mute event in the database.
"""

import uuid as uuid_mod
from typing import Any

from app.infra.globals import get_pool, sio
from app.infra.websocket.session_store import get_session_by_chat_id
from app.tools.entries.attempt_mutes.create import create_attempt_mutes
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
            pool = get_pool()
            async with pool.acquire() as conn:
                # TODO: wire up real call_id from audio session context
                await create_attempt_mutes(
                    conn,
                    conversation_id=uuid_mod.UUID(session.conversation_id),
                    call_id=uuid_mod.uuid4(),
                    muted=muted,
                )
        except Exception as e:
            logger.warning(f"Failed to record mute event: {e}")

    await session.inbound_queue.put({"type": "mic.set_muted", "muted": muted})

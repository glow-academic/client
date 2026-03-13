"""Client-facing attempt_audio_stop handler.

Thin wrapper — delegates to attempt_audio_stop_internal_impl.
"""

from typing import Any

from app.infra.globals import sio
from app.socket.v5.client.attempt.audio.stop_impl import (
    attempt_audio_stop_internal_impl,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_audio_stop(sid: str, data: dict[str, Any]) -> None:
    """Record completion and emit generate_audio_session_complete."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return

    try:
        await attempt_audio_stop_internal_impl({"chat_id": chat_id, "sid": sid})
    except ValueError:
        return  # No active session — silently ignore
    except Exception as e:
        logger.warning(f"Error in attempt_audio_stop: {e}")

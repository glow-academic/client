"""Shared audio session lifecycle — adapter singleton + cleanup.

Used by generate.py (session creation), audio_session.py (stop),
disconnect.py (cleanup on disconnect), and the stale session reaper.
"""

import logging

from app.infra.v4.websocket.adapters.audio.realtime import RealtimeAudioAdapter
from app.infra.v4.websocket.session_store import AudioSession, remove_session
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
)

logger = logging.getLogger(__name__)

_audio_adapter: RealtimeAudioAdapter | None = None


def get_audio_adapter() -> RealtimeAudioAdapter:
    """Get or create the audio adapter singleton."""
    global _audio_adapter
    if _audio_adapter is None:
        from app.socket.v5.internal.attempt.audio.events import get_audio_emitter

        _audio_adapter = RealtimeAudioAdapter(emitter=get_audio_emitter())
    return _audio_adapter


async def cleanup_audio_session(session: AudioSession) -> None:
    """Stop adapter tasks + remove session from store. Idempotent."""
    group_id = session.group_id
    try:
        adapter = get_audio_adapter()
        try:
            await adapter.stop_session(session)
        except Exception as e:
            logger.warning(f"Error stopping audio adapter during cleanup: {e}")

        remove_session(group_id)

        async with _voice_message_ids_lock:
            _voice_message_ids.pop(group_id, None)

        logger.info(f"Audio session cleaned up - group_id={group_id}")
    except Exception as e:
        logger.exception(f"Error during audio session cleanup: {e}")

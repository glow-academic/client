"""Shared helpers for attempt audio handlers.

Private to the audio subsystem — not imported outside attempt/audio/.
"""

import logging
from typing import Any

from app.infra.v4.websocket.adapters.audio.openai import OpenAIRealtimeAdapter
from app.infra.v4.websocket.session_store import (
    AudioSession,
    get_session_by_group_id,
    remove_session,
)
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    get_internal_sio,
)

logger = logging.getLogger(__name__)

internal_sio = get_internal_sio()

# Global adapter instance (singleton)
_audio_adapter: OpenAIRealtimeAdapter | None = None


def get_audio_adapter() -> OpenAIRealtimeAdapter:
    """Get or create the audio adapter singleton."""
    global _audio_adapter
    if _audio_adapter is None:
        _audio_adapter = OpenAIRealtimeAdapter()
    return _audio_adapter


async def cleanup_voice_session(session: AudioSession) -> None:
    """Clean up a voice session — stop adapter, remove from stores.

    Safe to call multiple times (idempotent). Used by stop.py and disconnect.py.
    """
    group_id = session.group_id
    try:
        adapter = get_audio_adapter()
        try:
            await adapter.stop_session(session)
        except Exception as e:
            logger.warning(f"Error stopping audio adapter during cleanup: {e}")

        _voice_sessions.pop(group_id, None)
        remove_session(group_id)

        async with _voice_message_ids_lock:
            _voice_message_ids.pop(group_id, None)

        logger.info(f"Voice session cleaned up - group_id={group_id}")
    except Exception as e:
        logger.exception(f"Error during voice session cleanup: {e}")


def get_session_for_group(group_id: str) -> Any:
    """Get the audio session for a group_id.

    Returns the AudioSession if one exists, None otherwise.
    """
    # First try session store
    session = get_session_by_group_id(group_id)
    if session:
        return session

    # Fallback to _voice_sessions
    session_data = _voice_sessions.get(group_id)
    if session_data:
        return session_data.get("session")
    return None


async def emit_audio_delta(group_id: str, audio_data: bytes) -> bool:
    """Emit audio delta via internal event bus.

    Returns True if emitted, False if no session exists.
    """
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_audio_delta",
        {
            "group_id": group_id,
            "audio": audio_data,
        },
    )
    return True


async def emit_user_speech_start(group_id: str, item_id: str) -> bool:
    """Emit user speech start via internal event bus."""
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_user_speech_start",
        {
            "group_id": group_id,
            "item_id": item_id,
        },
    )
    return True


async def emit_user_speech_delta(group_id: str, item_id: str, transcript: str) -> bool:
    """Emit user speech transcript delta via internal event bus."""
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_user_speech_delta",
        {
            "group_id": group_id,
            "item_id": item_id,
            "transcript": transcript,
        },
    )
    return True

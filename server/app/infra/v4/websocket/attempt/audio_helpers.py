"""Shared helpers for attempt audio handlers.

Private to the audio subsystem — not imported outside attempt/audio/.
"""

from typing import Any

from app.infra.v4.websocket.adapters.audio.openai import OpenAIRealtimeAdapter
from app.infra.v4.websocket.session_store import (
    get_session_by_group_id,
)
from app.main import (
    _voice_sessions,
    get_internal_sio,
)

internal_sio = get_internal_sio()

# SQL path for voice session context
SQL_PATH_VOICE_CONTEXT = (
    "app/sql/v4/queries/audio/get_voice_session_context_complete.sql"
)

# Global adapter instance (singleton)
_audio_adapter: OpenAIRealtimeAdapter | None = None


def get_audio_adapter() -> OpenAIRealtimeAdapter:
    """Get or create the audio adapter singleton."""
    global _audio_adapter
    if _audio_adapter is None:
        _audio_adapter = OpenAIRealtimeAdapter()
    return _audio_adapter


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

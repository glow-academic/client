"""Audio generation event contract — all generate_audio_* events in one place.

This module defines every internal event that the audio subsystem emits.
The adapter (openai.py) calls these functions instead of emitting directly,
so the event schema is visible alongside generate.py rather than buried
in the adapter transport layer.

Event naming convention: generate_audio_{sub}_{phase}
  - generate_audio_start          — session ready
  - generate_audio_complete       — session torn down
  - generate_audio_delta          — assistant audio chunk
  - generate_audio_error          — adapter or provider error
  - generate_audio_transcript_delta  — assistant transcript chunk
  - generate_audio_user_speech_start    — VAD detected user speaking
  - generate_audio_user_speech_delta    — user speech transcript chunk
  - generate_audio_user_speech_complete — user speech finalized
"""

from typing import Any

from app.main import get_internal_sio

internal_sio = get_internal_sio()


async def emit_audio_delta(group_id: str, audio: bytes) -> None:
    """Assistant audio chunk (PCM16 bytes)."""
    await internal_sio.emit(
        "generate_audio_delta",
        {"group_id": group_id, "audio": audio},
    )


async def emit_audio_transcript_delta(group_id: str, transcript: str) -> None:
    """Assistant transcript chunk (for display alongside audio)."""
    await internal_sio.emit(
        "generate_audio_transcript_delta",
        {"group_id": group_id, "transcript": transcript},
    )


async def emit_audio_user_speech_start(group_id: str, item_id: str) -> None:
    """VAD detected user started speaking."""
    await internal_sio.emit(
        "generate_audio_user_speech_start",
        {"group_id": group_id, "item_id": item_id},
    )


async def emit_audio_user_speech_delta(
    group_id: str, item_id: str, transcript: str
) -> None:
    """User speech transcript chunk."""
    await internal_sio.emit(
        "generate_audio_user_speech_delta",
        {"group_id": group_id, "item_id": item_id, "transcript": transcript},
    )


async def emit_audio_user_speech_complete(
    group_id: str, item_id: str, transcript: str
) -> None:
    """User speech finalized — triggers DB write in domain translator."""
    await internal_sio.emit(
        "generate_audio_user_speech_complete",
        {"group_id": group_id, "item_id": item_id, "transcript": transcript},
    )


async def emit_audio_error(group_id: str, error_message: str) -> None:
    """Adapter or provider error."""
    await internal_sio.emit(
        "generate_audio_error",
        {"group_id": group_id, "error_message": error_message},
    )


async def emit_audio_response_done(
    group_id: str, usage: dict[str, Any] | None = None
) -> None:
    """Provider response completed (for logging/metrics)."""
    await internal_sio.emit(
        "generate_audio_response_done",
        {"group_id": group_id, "usage": usage or {}},
    )

"""Audio generation event contract — all generate_audio_* events in one place.

This module provides:
1. InternalBusAudioEmitter — concrete AudioEventEmitter that wraps internal_sio.emit()
2. get_audio_emitter() — factory for use by the audio adapter singleton

The adapter (realtime.py) receives an AudioEventEmitter via its constructor,
keeping the infra layer decoupled from the socket layer.

Event naming convention: generate_audio_{sub}_{phase}
  - generate_audio_delta                — assistant audio chunk
  - generate_audio_error                — adapter or provider error
  - generate_audio_transcript_delta     — assistant transcript chunk
  - generate_audio_user_speech_start    — VAD detected user speaking
  - generate_audio_user_speech_delta    — user speech transcript chunk
  - generate_audio_user_speech_complete — user speech finalized
  - generate_audio_response_done        — provider response completed
"""

from typing import Any

from app.main import get_internal_sio


class InternalBusAudioEmitter:
    """Concrete AudioEventEmitter that emits via the internal event bus.

    Satisfies the AudioEventEmitter protocol defined in
    app.infra.v4.websocket.adapters.audio.base.
    """

    def __init__(self) -> None:
        self._bus = get_internal_sio()

    async def on_audio_delta(self, group_id: str, audio: bytes) -> None:
        """Assistant audio chunk (PCM16 bytes)."""
        await self._bus.emit(
            "generate_audio_delta",
            {"group_id": group_id, "audio": audio},
        )

    async def on_transcript_delta(self, group_id: str, transcript: str) -> None:
        """Assistant transcript chunk (for display alongside audio)."""
        await self._bus.emit(
            "generate_audio_transcript_delta",
            {"group_id": group_id, "transcript": transcript},
        )

    async def on_user_speech_start(self, group_id: str, item_id: str) -> None:
        """VAD detected user started speaking."""
        await self._bus.emit(
            "generate_audio_user_speech_start",
            {"group_id": group_id, "item_id": item_id},
        )

    async def on_user_speech_delta(
        self, group_id: str, item_id: str, transcript: str
    ) -> None:
        """User speech transcript chunk."""
        await self._bus.emit(
            "generate_audio_user_speech_delta",
            {"group_id": group_id, "item_id": item_id, "transcript": transcript},
        )

    async def on_user_speech_complete(
        self, group_id: str, item_id: str, transcript: str
    ) -> None:
        """User speech finalized — triggers DB write in domain translator."""
        await self._bus.emit(
            "generate_audio_user_speech_complete",
            {"group_id": group_id, "item_id": item_id, "transcript": transcript},
        )

    async def on_error(self, group_id: str, error_message: str) -> None:
        """Adapter or provider error."""
        await self._bus.emit(
            "generate_audio_error",
            {"group_id": group_id, "error_message": error_message},
        )

    async def on_response_done(
        self, group_id: str, usage: dict[str, Any] | None = None
    ) -> None:
        """Provider response completed (for logging/metrics)."""
        await self._bus.emit(
            "generate_audio_response_done",
            {"group_id": group_id, "usage": usage or {}},
        )


def get_audio_emitter() -> InternalBusAudioEmitter:
    """Factory for the audio event emitter singleton."""
    return InternalBusAudioEmitter()

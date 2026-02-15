"""Attempt audio event handlers for voice mode.

Client-to-server events:
- attempt_audio_start: Start a voice session

Generic events (handled by audio_session.py):
- audio_frame: Send audio frames
- audio_mute: Toggle microphone mute
- audio_stop: Stop a voice session

Internal events (BFF translation layer — all prefixed generate_audio_*):
- generate_audio_start -> attempt_audio_ready
- generate_audio_complete -> attempt_audio_ended
- generate_audio_delta -> attempt_assistant_audio
- generate_audio_user_speech_start -> attempt_user_start
- generate_audio_user_speech_delta -> attempt_user_delta
- generate_audio_user_speech_complete -> attempt_user_complete
- generate_audio_transcript_delta -> (assistant transcript)
- generate_audio_error -> attempt_error
"""

from fastapi import APIRouter

from . import (
    delta,
    error,
    speech_complete,
    speech_delta,
    speech_start,
    start,
    stop,
)

__all__ = [
    "delta",
    "error",
    "speech_complete",
    "speech_delta",
    "speech_start",
    "start",
    "stop",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(start.client_router)
client_router.include_router(stop.client_router)

server_router.include_router(start.server_router)
server_router.include_router(stop.server_router)
server_router.include_router(delta.server_router)
server_router.include_router(speech_start.server_router)
server_router.include_router(speech_delta.server_router)

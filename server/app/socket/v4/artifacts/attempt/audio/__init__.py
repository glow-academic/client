"""Attempt audio event handlers for voice mode.

Client-to-server events:
- attempt_audio_start: Start a voice session
- attempt_audio_stop: Stop a voice session
- attempt_audio_frame: Send audio frames
- attempt_mic_mute: Toggle microphone mute

Internal events (BFF translation layer):
- generate_audio_delta -> attempt_assistant_audio
- generate_user_speech_start -> attempt_user_start
- generate_user_speech_delta -> attempt_user_delta
- generate_audio_error -> attempt_error
"""

from fastapi import APIRouter

from . import (
    delta,
    error,
    frame,
    mic_mute,
    speech_delta,
    speech_start,
    start,
    stop,
)

__all__ = [
    "delta",
    "error",
    "frame",
    "mic_mute",
    "speech_delta",
    "speech_start",
    "start",
    "stop",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(start.client_router)
client_router.include_router(stop.client_router)
client_router.include_router(frame.client_router)
client_router.include_router(mic_mute.client_router)

server_router.include_router(start.server_router)
server_router.include_router(stop.server_router)
server_router.include_router(delta.server_router)
server_router.include_router(speech_start.server_router)
server_router.include_router(speech_delta.server_router)

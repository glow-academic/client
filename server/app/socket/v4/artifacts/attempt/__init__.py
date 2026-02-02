"""Attempt simulation socket handlers.

Handles WebSocket events for active attempts:

Legacy events:
- attempt_message: Send a message during an attempt (complex payload)
- attempt_grade: Grade an attempt

New unified attempt_* events:
- attempt_join: Join a chat room
- attempt_leave: Leave a chat room
- attempt_send: Send a message (simplified payload)
- attempt_stop: Stop message generation
- attempt_end: End current chat
- attempt_end_all: End all chats in attempt
- attempt_audio_start: Start voice session
- attempt_audio_stop: Stop voice session
- attempt_audio_frame: Send audio frame
- attempt_mic_mute: Toggle microphone mute
- attempt_response_submit: Submit video question response

Event flow:
1. Client sends attempt_send -> Server creates messages, routes to AI, streams progress
2. Server emits attempt_assistant_start -> Client shows placeholder
3. Server emits attempt_assistant_delta -> Client shows streaming
4. Server emits attempt_assistant_complete -> Client shows final message
5. Server emits attempt_turn_complete -> Client updates state
6. Server emits attempt_hint_progress -> Client shows hints (auto-triggered)
"""

from fastapi import APIRouter

from . import audio, complete, control, error, grade, message, progress, responses, room, send

__all__ = [
    "audio",
    "complete",
    "control",
    "error",
    "grade",
    "message",
    "progress",
    "responses",
    "room",
    "send",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register legacy client-to-server events
client_router.include_router(message.client_router)
client_router.include_router(grade.client_router)

# Register new unified attempt_* client-to-server events
client_router.include_router(room.client_router)
client_router.include_router(send.client_router)
client_router.include_router(control.client_router)
client_router.include_router(audio.client_router)
client_router.include_router(responses.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(message.server_router)
server_router.include_router(grade.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

# Register new unified attempt_* server-to-client events
server_router.include_router(room.server_router)
server_router.include_router(send.server_router)
server_router.include_router(control.server_router)
server_router.include_router(audio.server_router)
server_router.include_router(responses.server_router)

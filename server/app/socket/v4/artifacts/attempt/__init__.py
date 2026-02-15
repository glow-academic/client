"""Attempt simulation socket handlers.

Handles WebSocket events for active attempts:

Client-to-server events:
- attempt_message: Send a message during an attempt
- attempt_grade: Grade an attempt
- attempt_join: Join a chat room
- attempt_leave: Leave a chat room
- attempt_stop: Stop message generation
- attempt_end: End current chat
- attempt_end_all: End all chats in attempt
- attempt_audio_start: Start voice session
- attempt_audio_stop: Stop voice session
- attempt_audio_frame: Send audio frame
- attempt_mic_mute: Toggle microphone mute
- attempt_response_submit: Submit video question response

Event flow:
1. Client sends attempt_message -> Server creates messages, routes to AI, streams progress
2. Server emits attempt_user_complete -> Client shows user message
3. Server emits attempt_assistant_start -> Client shows placeholder
4. Server emits attempt_assistant_delta -> Client shows streaming
5. Server emits attempt_assistant_complete -> Client shows final message
6. Server emits attempt_complete -> Client clears sending state (terminal event)
7. Server emits attempt_hint_progress -> Client shows hints (auto-triggered)
"""

from fastapi import APIRouter

from . import (
    audio,
    complete,
    end,
    end_all,
    error,
    grade,
    join,
    leave,
    message,
    progress,
    responses,
    stop,
)

__all__ = [
    "audio",
    "complete",
    "end",
    "end_all",
    "error",
    "grade",
    "join",
    "leave",
    "message",
    "progress",
    "responses",
    "stop",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(message.client_router)
client_router.include_router(grade.client_router)
client_router.include_router(join.client_router)
client_router.include_router(leave.client_router)
client_router.include_router(stop.client_router)
client_router.include_router(end.client_router)
client_router.include_router(end_all.client_router)
client_router.include_router(audio.client_router)
client_router.include_router(responses.client_router)

# Register server-to-client events
server_router.include_router(message.server_router)
server_router.include_router(grade.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)
server_router.include_router(join.server_router)
server_router.include_router(stop.server_router)
server_router.include_router(end.server_router)
server_router.include_router(end_all.server_router)
server_router.include_router(audio.server_router)
server_router.include_router(responses.server_router)

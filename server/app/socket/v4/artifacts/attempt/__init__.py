"""Attempt simulation socket handlers.

Handles WebSocket events for active attempts:
- attempt_message: Send a message during an attempt
- attempt_grade: Grade an attempt

Event flow:
1. Client sends attempt_message -> Server creates messages, routes to AI, streams progress
2. Server emits attempt_progress -> Client shows streaming
3. Server emits attempt_complete -> Client shows final message
4. Client sends attempt_grade -> Server triggers grading
5. Server emits attempt_graded -> Client shows grade
"""

from fastapi import APIRouter

from . import complete, error, grade, message, progress

__all__ = [
    "complete",
    "error",
    "grade",
    "message",
    "progress",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(message.client_router)
client_router.include_router(grade.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(message.server_router)
server_router.include_router(grade.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

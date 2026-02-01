"""Training simulation socket handlers.

Handles WebSocket events for training sessions:
- training_start: Start a new training session (creates attempt/chat, optionally triggers scenario generation)

Event flow:
1. Client sends training_start -> Server creates attempt/chat, emits training_started
2. If scenario needs generation -> Server emits scenario_generate internally
3. Server emits training_progress -> Client shows generation progress
4. Server emits training_complete -> Client shows completed scenario
"""

from fastapi import APIRouter

from . import complete, error, progress, start

__all__ = [
    "complete",
    "error",
    "progress",
    "start",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(start.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(start.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

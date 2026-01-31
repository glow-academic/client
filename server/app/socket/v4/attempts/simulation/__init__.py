"""Simulation attempt socket v4 API routers - handles attempt generation events.

This module provides unified handlers for simulation chat messages following
the clean artifacts/persona/ pattern. It properly fetches and passes all context
(tools, developer instructions, chat history) to generate_artifact.

Event Flow:
    Client -> Server:
        attempt_generate: User sends message (text or audio)
        attempt_regenerate: Regenerate last assistant message

    Server -> Client:
        attempt_started: New assistant message placeholder created
        attempt_progress: Token streaming delta
        attempt_complete: Generation complete, message saved
        attempt_error: Error occurred
"""

from fastapi import APIRouter

from . import complete, error, generate, progress

client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(generate.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(generate.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

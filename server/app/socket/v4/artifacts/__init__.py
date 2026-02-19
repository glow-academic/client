"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import (
    attempt,
    audio_events,
    audio_session,
    auth,
    benchmark,
    call_events,
    generate,
    home,
    practice,
    simulation,
    test,
    training,
)

__all__ = [
    "attempt",
    "audio_events",
    "audio_session",
    "auth",
    "benchmark",
    "call_events",
    "generate",
    "home",
    "practice",
    "simulation",
    "test",
    "training",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(auth.client_router)
client_router.include_router(training.client_router)
client_router.include_router(attempt.client_router)
client_router.include_router(benchmark.client_router)
client_router.include_router(test.client_router)
client_router.include_router(home.client_router)
client_router.include_router(practice.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(auth.server_router)
server_router.include_router(training.server_router)
server_router.include_router(attempt.server_router)
server_router.include_router(benchmark.server_router)
server_router.include_router(test.server_router)
server_router.include_router(simulation.server_router)
server_router.include_router(home.server_router)
server_router.include_router(practice.server_router)
server_router.include_router(call_events.server_router)

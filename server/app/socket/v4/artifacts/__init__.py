"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import (
    attempt,
    benchmark,
    frames,
    generate,
    simulation,
    test,
    tool_call,
    tool_result,
    training,
)

__all__ = [
    "attempt",
    "benchmark",
    "frames",
    "generate",
    "simulation",
    "test",
    "tool_call",
    "tool_result",
    "training",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(training.client_router)
client_router.include_router(attempt.client_router)
client_router.include_router(benchmark.client_router)
client_router.include_router(test.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(training.server_router)
server_router.include_router(attempt.server_router)
server_router.include_router(benchmark.server_router)
server_router.include_router(test.server_router)
server_router.include_router(simulation.server_router)
server_router.include_router(tool_call.server_router)
server_router.include_router(tool_result.server_router)

"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import frames, generate, simulation, tool_call, tool_result

__all__ = [
    "frames",
    "generate",
    "simulation",
    "tool_call",
    "tool_result",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register server-to-server events (internal event listeners)
server_router.include_router(simulation.server_router)
server_router.include_router(tool_call.server_router)
server_router.include_router(tool_result.server_router)

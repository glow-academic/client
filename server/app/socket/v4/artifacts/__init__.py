"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import complete, error, frames, generate, progress, simulation

__all__ = ["complete", "error", "frames", "generate", "progress", "simulation"]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register server-to-server events (internal event listeners)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)
server_router.include_router(simulation.server_router)

"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import complete, end, error, generate, log, progress, start

__all__ = ["complete", "end", "error", "generate", "log", "progress", "start"]

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
server_router.include_router(end.server_router)


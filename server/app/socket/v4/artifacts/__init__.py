"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from . import end, error, generate, log, start

__all__ = ["end", "error", "generate", "log", "start"]

# Export routers for inclusion in main router
client_router = start.client_router
server_router = start.server_router


"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from . import audio, end, error, generate, log, start

__all__ = ["audio", "end", "error", "generate", "log", "start"]

# Export routers for inclusion in main router
client_router = start.client_router
server_router = start.server_router

# Include audio routers
from .audio import start as audio_start

client_router.include_router(audio_start.client_router, prefix="/audio")
server_router.include_router(audio_start.server_router, prefix="/audio")

from .audio import events as audio_events

client_router.include_router(audio_events.client_router, prefix="/audio")
server_router.include_router(audio_events.server_router, prefix="/audio")

from .audio import stop as audio_stop

client_router.include_router(audio_stop.client_router, prefix="/audio")
server_router.include_router(audio_stop.server_router, prefix="/audio")


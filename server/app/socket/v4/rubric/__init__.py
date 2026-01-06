"""Rubric page handlers - handles rubric-specific logic (standard groups) then routes to artifacts."""

from fastapi import APIRouter

from . import complete, error, generate, progress

__all__ = ["generate", "progress", "complete", "error"]

# Combine routers from all handlers
client_router = APIRouter()
server_router = APIRouter()

# Include routers from each handler
client_router.include_router(generate.client_router)
client_router.include_router(progress.client_router)
client_router.include_router(complete.client_router)
client_router.include_router(error.client_router)

server_router.include_router(generate.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)


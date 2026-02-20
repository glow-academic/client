"""Invocation socket routers - generation + progress/complete/error events."""

from fastapi import APIRouter

from . import complete, error, generate, progress

__all__ = ["generate", "progress", "complete", "error"]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(generate.client_router)

server_router.include_router(generate.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

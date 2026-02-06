"""Benchmark socket handlers.

Handles WebSocket events for benchmark orchestration:
- benchmark_start: Start benchmark attempt, create structure, return to client

Client controls test execution via test/ handlers.
"""

from fastapi import APIRouter

from . import complete, error, progress, start

__all__ = [
    "complete",
    "error",
    "progress",
    "start",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(start.client_router)

server_router.include_router(start.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

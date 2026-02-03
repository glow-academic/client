"""Test socket handlers.

Handles WebSocket events for benchmark test interactions:
- test_join / test_leave
- test_stop
- test_send (placeholder)
"""

from fastapi import APIRouter

from . import complete, control, error, progress, room, send

__all__ = [
    "complete",
    "control",
    "error",
    "progress",
    "room",
    "send",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(room.client_router)
client_router.include_router(control.client_router)
client_router.include_router(send.client_router)

server_router.include_router(room.server_router)
server_router.include_router(control.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

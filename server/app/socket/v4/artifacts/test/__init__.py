"""Test socket handlers.

Handles WebSocket events for benchmark test interactions:
- test_run: Run one auto-regressive replay
- test_run_all: Run all remaining auto-regressive replays
- test_join / test_leave: Room management
- test_stop: Stop current run
"""

from fastapi import APIRouter

from . import complete, control, error, invocation, permissions, progress, room, run, run_all, types

__all__ = [
    "complete",
    "control",
    "error",
    "invocation",
    "permissions",
    "progress",
    "room",
    "run",
    "run_all",
    "types",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(room.client_router)
client_router.include_router(control.client_router)
client_router.include_router(run.client_router)
client_router.include_router(run_all.client_router)

server_router.include_router(room.server_router)
server_router.include_router(control.server_router)
server_router.include_router(invocation.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)
server_router.include_router(run.server_router)
server_router.include_router(run_all.server_router)

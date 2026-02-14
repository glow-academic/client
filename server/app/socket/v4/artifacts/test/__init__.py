"""Test socket handlers.

Handles WebSocket events for benchmark test interactions:
- test_run: Run one auto-regressive replay
- test_run_all: Run all remaining auto-regressive replays
- test_join / test_leave: Room management
- test_stop: Stop current run
"""

from fastapi import APIRouter

from . import (
    complete,
    error,
    grade,
    invocation,
    join,
    leave,
    progress,
    run,
    run_all,
    stop,
)

__all__ = [
    "complete",
    "error",
    "grade",
    "invocation",
    "join",
    "leave",
    "progress",
    "run",
    "run_all",
    "stop",
]

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(join.client_router)
client_router.include_router(leave.client_router)
client_router.include_router(stop.client_router)
client_router.include_router(run.client_router)
client_router.include_router(run_all.client_router)
client_router.include_router(grade.client_router)

server_router.include_router(join.server_router)
server_router.include_router(stop.server_router)
server_router.include_router(invocation.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)
server_router.include_router(run.server_router)
server_router.include_router(run_all.server_router)
server_router.include_router(grade.server_router)

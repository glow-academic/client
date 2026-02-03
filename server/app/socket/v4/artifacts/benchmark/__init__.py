"""Benchmark socket handlers.

Handles WebSocket events for benchmark orchestration:
- benchmark_start: Start benchmark attempt (single entry point)
- benchmarks_started/progress/complete/error: Client-facing events

Internal orchestration events:
- benchmark_next, benchmark_advance, benchmark_end, benchmark_eval_complete
- eval routing via *_eval_start handlers
"""

from fastapi import APIRouter

from . import advance, complete, error, eval, eval_complete, next, progress, start

__all__ = [
    "advance",
    "complete",
    "error",
    "eval",
    "eval_complete",
    "next",
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

"""Benchmark progress handler.

Emits benchmark_progress to track overall benchmark progress.
Individual test progress is handled by test/progress.py.
"""

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkProgressEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark/progress", response_model=dict[str, bool])
async def benchmark_progress_api(request: BenchmarkProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark progress update."""
    return {"success": True}

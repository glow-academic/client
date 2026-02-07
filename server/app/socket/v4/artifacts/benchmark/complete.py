"""Benchmark completion handler.

Emits benchmark_complete when all tests in an attempt are done.
Actual test completion is handled by test/complete.py.
"""

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkCompleteEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark/complete", response_model=dict[str, bool])
async def benchmark_complete_api(request: BenchmarkCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark completed."""
    return {"success": True}

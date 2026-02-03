"""Benchmark completion handler.

Listens to AI generation completion events for eval runs (eval_mode=True)
and emits internal benchmark_eval_complete events.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkEvalCompletePayload

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_benchmark_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete events for eval runs."""
    if not data.get("eval_mode", False):
        return

    group_id = data.get("group_id")
    run_id = data.get("run_id")

    if not group_id and not run_id:
        return

    await internal_sio.emit(
        "benchmark_eval_complete",
        BenchmarkEvalCompletePayload(
            success=True,
            message="Eval completed successfully",
            sid=data.get("sid"),
            run_id=run_id,
            group_id=group_id,
        ).model_dump(mode="json"),
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark/complete", response_model=dict[str, bool])
async def benchmark_complete_api(request: BenchmarkEvalCompletePayload) -> dict[str, bool]:
    """Internal event: Benchmark eval completed."""
    return {"success": True}

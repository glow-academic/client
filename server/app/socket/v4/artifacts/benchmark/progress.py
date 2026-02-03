"""Benchmark progress handler.

Listens to AI generation progress events for eval runs (eval_mode=True)
and emits benchmark progress updates to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkProgressEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_benchmark_progress(data: dict[str, Any]) -> None:
    """Handle generate_*_progress events for eval runs."""
    if not data.get("eval_mode", False):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    event = BenchmarkProgressEvent(
        attempt_id=data.get("attempt_id"),
        test_id=data.get("test_id"),
        run_id=data.get("run_id"),
        group_id=data.get("group_id"),
        status=data.get("type", "progress"),
        message=data.get("event_type"),
        success=True,
    )

    await sio.emit(
        "benchmarks_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark/progress", response_model=dict[str, bool])
async def benchmark_progress_api(request: BenchmarkProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark progress update."""
    return {"success": True}

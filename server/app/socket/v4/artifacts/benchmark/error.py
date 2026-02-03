"""Benchmark error handler.

Listens to AI generation errors (eval_mode=True) and internal benchmark_error events.
Emits benchmarks_error to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkErrorEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_benchmark_generation_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error events for eval runs."""
    if not data.get("eval_mode", False):
        return

    await internal_sio.emit(
        "benchmark_eval_complete",
        {
            "success": False,
            "message": data.get("error_message")
            or data.get("message", "Benchmark eval failed"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "sid": data.get("sid", ""),
        },
    )


@internal_sio.on("benchmark_error")  # type: ignore
async def handle_benchmark_error(data: dict[str, Any]) -> None:
    """Handle internal benchmark_error events and emit to client."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    message = data.get("error_message") or data.get("message", "Benchmark error")

    event = BenchmarkErrorEvent(
        message=message,
        attempt_id=data.get("attempt_id"),
        test_id=data.get("test_id"),
        run_id=data.get("run_id"),
        group_id=data.get("group_id"),
        error_type=data.get("error_type"),
    )

    await sio.emit(
        "benchmarks_error",
        event.model_dump(mode="json"),
        room=sid,
    )
    attempt_id = data.get("attempt_id")
    if attempt_id:
        await sio.emit(
            "benchmarks_error",
            event.model_dump(mode="json"),
            room=f"benchmark_{attempt_id}",
        )

    logger.error(
        f"Benchmark error - attempt_id={data.get('attempt_id')}, "
        f"test_id={data.get('test_id')}, error={message}"
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark/error", response_model=dict[str, bool])
async def benchmark_error_api(request: BenchmarkErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark error occurred."""
    return {"success": True}

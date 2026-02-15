"""Benchmark bundle error handler - listens to generate_*_error events and emits benchmark-bundle-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import (
    BenchmarkBundleGenerationErrorEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/benchmark_bundle_generation_error")
async def benchmark_bundle_generation_error_api(
    request: BenchmarkBundleGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Benchmark bundle generation error.

    Emitted when benchmark bundle resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_benchmark_bundle_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by benchmark_bundle artifact_type and emit benchmark-bundle-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "benchmark_bundle":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during benchmark bundle generation"
    )

    event = BenchmarkBundleGenerationErrorEvent(
        artifact_type="benchmark_bundle",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "benchmark_bundle_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )

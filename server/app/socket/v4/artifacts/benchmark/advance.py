"""Benchmark advance handler - updates client with test/run status."""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkAdvancePayload, BenchmarkProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("benchmark_advance")  # type: ignore
async def benchmark_advance_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_advance event from internal bus."""
    payload = BenchmarkAdvancePayload(**data)
    sid = data.get("sid", "")

    event = BenchmarkProgressEvent(
        attempt_id=payload.attempt_id,
        test_id=payload.test_id,
        run_id=payload.run_id,
        group_id=payload.group_id,
        status="advanced",
        message="Benchmark advanced",
        success=True,
    )

    if sid:
        await sio.emit(
            "benchmarks_progress",
            event.model_dump(mode="json"),
            room=sid,
        )

    await sio.emit(
        "benchmarks_progress",
        event.model_dump(mode="json"),
        room=f"benchmark_{payload.attempt_id}",
    )

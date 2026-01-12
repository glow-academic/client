"""Benchmark error handler - listens to artifact_generation_error events when eval_mode=True."""

import uuid
from typing import Any
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

@sio.on("artifact_generation_error")  # type: ignore
async def handle_benchmark_error(data: dict[str, Any]) -> None:
    """Handle artifact_generation_error events - only process when eval_mode=True."""
    eval_mode = data.get("eval_mode", False)
    if not eval_mode:
        return  # Not an eval - skip
    
    group_id_str = data.get("group_id")
    run_id = data.get("run_id")
    error_message = data.get("message") or data.get("error_message", "Unknown error")
    
    if not group_id_str:
        return  # Missing group_id
    
    # Emit benchmark_error for error handler
    await internal_sio.emit(
        "benchmark_error",
        {
            "group_id": group_id_str,
            "run_id": run_id,
            "error_message": error_message,
            "sid": data.get("sid", "internal"),
        },
    )

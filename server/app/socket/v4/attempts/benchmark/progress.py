"""Benchmark progress handler - listens to artifact_generation_progress events when eval_mode=True."""

from typing import Any

from app.main import sio


@sio.on("artifact_generation_progress")  # type: ignore
async def handle_benchmark_progress(data: dict[str, Any]) -> None:
    """Handle artifact_generation_progress events - only process when eval_mode=True."""
    eval_mode = data.get("eval_mode", False)
    if not eval_mode:
        return  # Not an eval - skip

    # Extract group_id for linking (used by complete handler)
    group_id = data.get("group_id")
    if not group_id:
        return  # Missing group_id

    # For now, no special processing needed
    # Events flow through normally to clients
    # Can add benchmark-specific progress tracking later if needed

"""Internal handler for test progress updates and run completion.

Handles:
- test_progress_update: re-emits as test_progress(type=progress)
- test_run_done: re-emits as test_progress(type=run_complete)
"""

from typing import Any

from app.main import get_internal_sio
from app.socket.v5.internal.test.types import TestProgressData, TestRunCompleteData

internal_sio = get_internal_sio()


@internal_sio.on("test_progress_update")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    """Handle test progress update events."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not invocation_id:
        return

    await internal_sio.emit(
        "test_progress",
        TestProgressData(
            sid=data.get("sid"),
            invocation_id=str(invocation_id),
            run_id=data.get("run_id"),
            current_run=data.get("current_run"),
            total_runs=data.get("total_runs"),
            message=data.get("message"),
        ).model_dump(mode="json"),
    )


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    """Handle test run completion."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not invocation_id:
        return

    invocation_id_str = str(invocation_id)
    current_run = data.get("current_run", 1)
    total_runs = data.get("total_runs", 1)
    remaining_runs = total_runs - current_run

    await internal_sio.emit(
        "test_progress",
        TestRunCompleteData(
            sid=data.get("sid"),
            invocation_id=invocation_id_str,
            run_id=str(data.get("run_id")) if data.get("run_id") else None,
            original_run_resource_id=str(data.get("original_run_resource_id"))
            if data.get("original_run_resource_id")
            else None,
            tool_calls=data.get("tool_calls"),
            current_run=current_run,
            total_runs=total_runs,
            remaining_runs=remaining_runs,
        ).model_dump(mode="json"),
    )

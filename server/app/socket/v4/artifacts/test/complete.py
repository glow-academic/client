"""Test complete handler.

Handles test run completion events and optionally chains to next run.
Emits test_run_complete to clients.
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import (
    TestAllCompleteEvent,
    TestRunCompleteEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    """Handle test run completion and optionally chain to next run.

    This handler:
    1. Emits test_run_complete to clients
    2. If run_all flag is set and there are more pending runs, triggers next run
    3. If no more pending runs, emits test_all_complete
    """
    sid = data.get("sid")
    chat_id = data.get("chat_id")
    run_id = data.get("run_id")
    run_all = data.get("run_all", False)

    if not chat_id:
        return

    chat_id_str = str(chat_id)

    # Get run completion details from data
    current_run = data.get("current_run", 1)
    total_runs = data.get("total_runs", 1)
    original_run_resource_id = data.get("original_run_resource_id")
    tool_calls = data.get("tool_calls")

    # Calculate remaining runs
    remaining_runs = total_runs - current_run

    # Emit test_run_complete
    event = TestRunCompleteEvent(
        chat_id=chat_id_str,
        run_id=str(run_id) if run_id else None,
        original_run_resource_id=str(original_run_resource_id)
        if original_run_resource_id
        else None,
        tool_calls=tool_calls,
        current_run=current_run,
        total_runs=total_runs,
        remaining_runs=remaining_runs,
    )

    if sid:
        await sio.emit("test_run_complete", event.model_dump(mode="json"), room=sid)

    await sio.emit(
        "test_run_complete",
        event.model_dump(mode="json"),
        room=f"test_{chat_id_str}",
    )

    # If run_all and there are more runs, trigger next
    if run_all and remaining_runs > 0:
        logger.info(
            f"Chaining to next run - chat_id={chat_id_str}, remaining={remaining_runs}"
        )
        test_id = data.get("test_id")
        await internal_sio.emit(
            "test_run",
            {
                "sid": sid,
                "chat_id": chat_id_str,
                "test_id": str(test_id) if test_id else chat_id_str,
                "run_all": True,
            },
        )
    elif run_all:
        # All runs complete
        all_complete_event = TestAllCompleteEvent(
            chat_id=chat_id_str,
            total_runs=total_runs,
            success=True,
        )
        if sid:
            await sio.emit(
                "test_all_complete",
                all_complete_event.model_dump(mode="json"),
                room=sid,
            )
        await sio.emit(
            "test_all_complete",
            all_complete_event.model_dump(mode="json"),
            room=f"test_{chat_id_str}",
        )
        logger.info(
            f"All test runs complete - chat_id={chat_id_str}, total={total_runs}"
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/run_complete", response_model=dict[str, bool])
async def test_run_complete_api(request: TestRunCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Single test run completed."""
    return {"success": True}

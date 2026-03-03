"""Internal test_next handler — find next pending run in existing test.

Handles: @internal_sio.on("test_next")

Fetches test websocket data, finds the first invocation with pending runs,
and emits test_started or test_all_complete accordingly.
"""

import uuid
from typing import Any

from app.v5.api.main.test.get import get_test_websocket
from app.v5.infra.globals import get_internal_sio, get_pool, sio
from app.v5.api.socket.types import TestAllCompleteEvent, determine_next_run
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_next")  # type: ignore
async def test_next_handler(data: dict[str, Any]) -> None:
    """Handle test_next — find next invocation with pending runs."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        test_id = uuid.UUID(str(data["test_id"]))
        await _find_and_emit_next_run(sid, test_id)
    except Exception as e:
        logger.exception(f"Error in test_next: {e}")
        await sio.emit(
            "test_error",
            {"message": f"Failed to find next run: {e}", "error_type": "internal"},
            room=sid,
        )


async def _find_and_emit_next_run(sid: str, test_id: uuid.UUID) -> None:
    """Find next invocation with pending runs and emit test_run or test_all_complete."""
    pool = get_pool()
    if not pool:
        logger.error("Database pool not initialized")
        return

    async with pool.acquire() as conn:
        result = await get_test_websocket(
            conn=conn,
            test_id=test_id,
            bypass_cache=True,
        )

    if not result.views or not result.views.test_invocation:
        logger.warning(f"No invocations found for test {test_id}")
        await sio.emit(
            "test_all_complete",
            TestAllCompleteEvent(
                invocation_id="",
                total_runs=0,
                success=True,
            ).model_dump(mode="json"),
            room=sid,
        )
        return

    # Find first invocation with pending runs
    for invocation in result.views.test_invocation:
        next_run_resource_id, current_run, total_runs = determine_next_run(
            invocation_run_ids=invocation.invocation_run_ids,
            run_ids=invocation.run_ids,
        )

        if next_run_resource_id:
            # Found a pending run — emit test_run internally
            await internal_sio.emit(
                "test_run",
                {
                    "sid": sid,
                    "invocation_id": str(invocation.invocation_id),
                    "test_id": str(test_id),
                },
            )
            return

    # All invocations complete — emit test_all_complete
    last_invocation = result.views.test_invocation[-1]
    total = len(last_invocation.run_ids) if last_invocation else 0
    await sio.emit(
        "test_all_complete",
        TestAllCompleteEvent(
            invocation_id=str(last_invocation.invocation_id) if last_invocation else "",
            total_runs=total,
            success=True,
        ).model_dump(mode="json"),
        room=sid,
    )
    logger.info(f"All test runs complete - test_id={test_id}")

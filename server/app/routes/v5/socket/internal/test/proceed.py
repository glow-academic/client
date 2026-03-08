"""Internal test_proceed handler — shared core logic for resolving the next invocation.

Handles: @internal_sio.on("test_proceed")

All test lifecycle events route through here:
- test_start → proceed with test_id (first invocation)
- test_next → proceed with test_id (after a run completes)
- test_end → proceed with completed_invocation_id (marks invocation done, then finds next)
- test_end_all → proceed with complete_all=True (marks all done → ended)

Flow:
1. If completed_invocation_id → create_test_invocation_completion
2. If complete_all → create_test_invocation_completion per uncompleted invocation → emit test_ended
3. Search invocations → count completed vs total → find next
4. All done? → emit test_ended
5. use_custom && !force_proceed → emit test_started (lobby)
6. create_test_invocation + create_test_invocation_bridge → refresh → emit
   - is_dynamic=true (default): client triggers test_run → LLM re-run → grade
   - is_dynamic=false (generation): skip re-run, grade existing output directly
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.v5.socket.internal.test.types import (
    TestErrorData,
    TestProceedData,
)
from app.routes.v5.tools.entries.test.get import get_tests
from app.routes.v5.tools.entries.test_invocation.create import (
    create_test_invocation,
)
from app.routes.v5.tools.entries.test_invocation.refresh import (
    refresh_test_invocation,
)
from app.routes.v5.tools.entries.test_invocation.search import (
    search_test_invocation_entries_internal,
)
from app.routes.v5.tools.entries.test_invocation_bridge.create import (
    create_test_invocation_bridge,
)
from app.routes.v5.tools.entries.test_invocation_completion.create import (
    create_test_invocation_completion,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_proceed")  # type: ignore
async def test_proceed_handler(data: dict[str, Any]) -> None:
    """Shared core: resolve context → check done → resolve invocation → emit."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        payload = TestProceedData(**data)
    except Exception as e:
        logger.exception(f"Invalid test_proceed payload: {e}")
        return

    try:
        test_id = uuid.UUID(payload.test_id)
        force_proceed = payload.force_proceed
        completed_invocation_id = (
            uuid.UUID(payload.completed_invocation_id)
            if payload.completed_invocation_id
            else None
        )
        complete_all = payload.complete_all

        # Step 1: If completed_invocation_id, mark that invocation completed
        if completed_invocation_id:
            async with get_db_connection() as conn:
                try:
                    await create_test_invocation_completion(
                        conn,
                        invocation_id=completed_invocation_id,
                        # TODO: call_id required but not available in this context
                    )
                except Exception:
                    logger.warning(
                        f"Failed to create test_completion for {completed_invocation_id} "
                        f"(may already exist)"
                    )

        # Step 2: If complete_all, mark all remaining invocations completed → ended
        if complete_all:
            async with get_db_connection() as conn:
                (
                    all_invocations,
                    _total_count,
                ) = await search_test_invocation_entries_internal(
                    conn,
                    test_ids=[test_id],
                    limit=1000,
                    bypass_mv=True,
                )
                for inv in all_invocations:
                    if not inv.invocation_completed:
                        try:
                            await create_test_invocation_completion(
                                conn,
                                invocation_id=inv.invocation_id,
                                # TODO: call_id required but not available in this context
                            )
                        except Exception:
                            pass
                await refresh_test_invocation(conn)
            await invalidate_tags(
                ["test", "tests", "benchmark"], redis=get_redis_client()
            )

            await internal_sio.emit(
                "test_ended",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "success": True,
                    "message": "All invocations completed",
                },
            )
            return

        # Step 3: Get context — search invocations, find next uncompleted
        async with get_db_connection() as conn:
            (
                all_invocations,
                _total_count,
            ) = await search_test_invocation_entries_internal(
                conn,
                test_ids=[test_id],
                limit=1000,
                bypass_mv=True,
            )

            tests = await get_tests(conn, ids=[test_id])

        is_dynamic = tests[0].is_dynamic if tests else True
        total_invocations = len(all_invocations)
        completed = [inv for inv in all_invocations if inv.invocation_completed]
        uncompleted = [inv for inv in all_invocations if not inv.invocation_completed]
        completed_count = len(completed)

        if not all_invocations:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Failed to resolve test context",
                    error_type="proceed",
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Check if all invocations are done
        if not uncompleted or completed_count >= total_invocations:
            await internal_sio.emit(
                "test_ended",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "success": True,
                    "message": "All invocations completed",
                },
            )
            return

        next_invocation = uncompleted[0]

        # Step 5: use_custom lobby
        if next_invocation.use_custom and not force_proceed:
            await internal_sio.emit(
                "test_started",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "invocation_entry_id": str(next_invocation.invocation_id),
                },
            )
            return

        # Step 6: Resolve invocation — create test_invocation_entry + bridge
        async with get_db_connection() as conn:
            inv_result = await create_test_invocation(
                conn,
                test_id=test_id,
            )
            test_invocation_id = inv_result.id

            await create_test_invocation_bridge(
                conn,
                test_invocation_id=test_invocation_id,
                invocation_id=next_invocation.invocation_id,
            )

        # Step 7: Refresh MVs + emit test_invocation_started
        async with get_db_connection() as conn:
            await refresh_test_invocation(conn)
        await invalidate_tags(["test", "tests", "benchmark"], redis=get_redis_client())

        await internal_sio.emit(
            "test_invocation_started",
            {
                "sid": sid,
                "test_id": str(test_id),
                "test_invocation_id": str(test_invocation_id),
                "is_dynamic": is_dynamic,
            },
        )

    except Exception as e:
        logger.exception(f"Error in test_proceed: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to proceed: {e}",
                error_type="proceed",
            ).model_dump(mode="json"),
        )

"""Internal test_proceed handler — shared core logic for resolving the next invocation.

Handles: @internal_sio.on("test_proceed")

All test lifecycle events route through here:
- test_start → proceed with test_id (first invocation)
- test_next → proceed with test_id (after a run completes)
- test_end → proceed with completed_invocation_id (marks invocation done, then finds next)
- test_end_all → proceed with complete_all=True (marks all done → ended)

Flow:
1. If completed_invocation_id → insert into test_completion_entry
2. If complete_all → mark all remaining invocations completed → emit test_ended
3. Get context SQL → next invocation_entry + use_custom
4. All done? → emit test_ended
5. use_custom && !force_proceed → emit test_started (lobby)
6. Resolve invocation → refresh → emit test_invocation_started
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from app.infra.globals import get_internal_sio
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.v5.socket.internal.test.types import (
    TestErrorData,
    TestProceedData,
)
from app.sql.types import (
    GetTestProceedContextSqlParams,
    GetTestProceedContextSqlRow,
    ResolveTestInvocationSqlParams,
    ResolveTestInvocationSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PROCEED_CONTEXT = (
    "app/sql/queries/generate/test/get_test_proceed_context_complete.sql"
)
SQL_PATH_RESOLVE_INVOCATION = (
    "app/sql/queries/generate/test/resolve_test_invocation_complete.sql"
)


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
                await conn.execute(
                    """INSERT INTO test_completion_entry (invocation_id, end_reason, generated, mcp)
                    VALUES ($1, 'completed', false, false)
                    ON CONFLICT DO NOTHING""",
                    completed_invocation_id,
                )

        # Step 2: If complete_all, mark all remaining invocations completed → ended
        if complete_all:
            async with get_db_connection() as conn:
                await conn.execute(
                    """INSERT INTO test_completion_entry (invocation_id, end_reason, generated, mcp)
                    SELECT tie.id, 'completed', false, false
                    FROM test_invocation_entry tie
                    WHERE tie.test_id = $1 AND tie.active = true
                      AND tie.id NOT IN (
                          SELECT tce.invocation_id FROM test_completion_entry tce
                          WHERE tce.active = true
                      )
                    ON CONFLICT DO NOTHING""",
                    test_id,
                )
                await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")
            await invalidate_tags(["test", "tests", "benchmark"])

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

        # Step 3: Get context in one SQL call
        async with get_db_connection() as conn:
            row = cast(
                GetTestProceedContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_PROCEED_CONTEXT,
                    params=GetTestProceedContextSqlParams(
                        p_test_id=test_id,
                    ),
                ),
            )

        if not row or not row.items:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Failed to resolve test context",
                    error_type="proceed",
                ).model_dump(mode="json"),
            )
            return

        ctx = row.items[0]

        # Step 4: Check if all invocations are done
        if ctx.invocation_entry_id is None or (
            ctx.completed_count is not None
            and ctx.total_invocations is not None
            and ctx.completed_count >= ctx.total_invocations
        ):
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

        # Step 5: use_custom lobby
        if ctx.use_custom and not force_proceed:
            await internal_sio.emit(
                "test_started",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "invocation_entry_id": str(ctx.invocation_entry_id),
                },
            )
            return

        # Step 6: Resolve invocation — create test_invocation_entry + bridge
        async with get_db_connection() as conn:
            resolve_row = cast(
                ResolveTestInvocationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_RESOLVE_INVOCATION,
                    params=ResolveTestInvocationSqlParams(
                        p_test_id=test_id,
                        p_invocation_entry_id=ctx.invocation_entry_id,
                    ),
                ),
            )

        if not resolve_row or not resolve_row.items:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Failed to create test invocation entry",
                    error_type="proceed",
                ).model_dump(mode="json"),
            )
            return

        test_invocation_id = resolve_row.items[0].test_invocation_id

        # Step 7: Refresh MVs + emit test_invocation_started
        async with get_db_connection() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")
        await invalidate_tags(["test", "tests", "benchmark"])

        await internal_sio.emit(
            "test_invocation_started",
            {
                "sid": sid,
                "test_id": str(test_id),
                "test_invocation_id": str(test_invocation_id),
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

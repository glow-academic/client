"""Test start handler.

Handles: test_start — create test or proceed to next pending run.
Dual-mode: create (eval_id) or next (test_id).
"""

import uuid
from typing import Any, cast

from app.api.v4.artifacts.test.get import get_test_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.test.run import _determine_next_run
from app.socket.v5.client.types import TestStartPayload
from app.sql.types import (
    CreateTestInvocationsSqlParams,
    CreateTestInvocationsSqlRow,
    CreateTestSqlParams,
    CreateTestSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_TEST = "app/sql/v4/queries/artifacts/test/create_test_complete.sql"
SQL_PATH_CREATE_INVOCATIONS = (
    "app/sql/v4/queries/generate/test/create_test_invocations_complete.sql"
)


@sio.event  # type: ignore
async def test_start(sid: str, data: dict[str, Any]) -> None:
    """Handle test_start event from client."""
    try:
        payload = TestStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": [sid],
                    "message": "Profile not found. Please reconnect.",
                    "error_type": "auth",
                },
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        if payload.test_id is None:
            # === CREATE MODE ===
            if not payload.eval_id:
                await internal_sio.emit(
                    "test_error",
                    {
                        "sid": sid,
                        "rooms": [sid],
                        "message": "eval_id is required to create a test",
                        "error_type": "validation",
                    },
                )
                return

            async with get_db_connection() as conn:
                # Step 1: Create test
                row = cast(
                    CreateTestSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_CREATE_TEST,
                        params=CreateTestSqlParams(
                            p_profile_id=profile_id,
                            p_eval_id=payload.eval_id,
                            p_infinite_mode=payload.infinite_mode,
                        ),
                    ),
                )

                if not row or not row.test_id:
                    await internal_sio.emit(
                        "test_error",
                        {
                            "sid": sid,
                            "rooms": [sid],
                            "message": "Failed to create test",
                            "error_type": "create",
                        },
                    )
                    return

                test_id = row.test_id

                # Step 2: Create invocations
                inv_row = cast(
                    CreateTestInvocationsSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_CREATE_INVOCATIONS,
                        params=CreateTestInvocationsSqlParams(
                            p_test_id=test_id,
                            p_eval_id=payload.eval_id,
                        ),
                    ),
                )

                if not inv_row or not inv_row.chats:
                    await internal_sio.emit(
                        "test_error",
                        {
                            "sid": sid,
                            "rooms": [sid],
                            "message": "Failed to create test invocations",
                            "error_type": "create",
                        },
                    )
                    return

                # Step 3: Refresh MVs
                await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")

            # Step 4: Invalidate caches
            await invalidate_tags(["test", "tests", "benchmark", "invocations"])

            # Step 5: Emit test_started via internal bus
            await internal_sio.emit(
                "test_started",
                {
                    "sid": sid,
                    "rooms": [sid],
                    "test_id": str(test_id),
                },
            )

            logger.info(f"Test created - profile_id={profile_id}, test_id={test_id}")

        else:
            # === NEXT MODE ===
            test_id = payload.test_id
            await _find_and_emit_next_run(sid, test_id)

    except Exception as e:
        logger.exception(f"Error in test_start: {e}")
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": [sid],
                "message": f"Failed to start test: {e}",
                "error_type": "internal",
            },
        )


async def _find_and_emit_next_run(sid: str, test_id: uuid.UUID) -> None:
    """Find next invocation with pending runs and emit."""
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
        await internal_sio.emit(
            "test_grade_complete",
            {
                "sid": sid,
                "rooms": [sid],
                "invocation_id": "",
                "total_runs": 0,
            },
        )
        return

    # Find first invocation with pending runs
    for invocation in result.views.test_invocation:
        next_run_resource_id, current_run, total_runs = _determine_next_run(
            invocation_run_ids=invocation.invocation_run_ids,
            run_ids=invocation.run_ids,
        )

        if next_run_resource_id:
            # Emit started with test_id so client knows which test
            await internal_sio.emit(
                "test_started",
                {
                    "sid": sid,
                    "rooms": [sid],
                    "test_id": str(test_id),
                },
            )
            return

    # All invocations complete
    last_invocation = result.views.test_invocation[-1]
    total = len(last_invocation.run_ids) if last_invocation else 0
    invocation_id_str = str(last_invocation.invocation_id) if last_invocation else ""
    await internal_sio.emit(
        "test_grade_complete",
        {
            "sid": sid,
            "rooms": [sid, f"test_{invocation_id_str}"] if invocation_id_str else [sid],
            "invocation_id": invocation_id_str,
            "total_runs": total,
        },
    )
    logger.info(f"All test runs complete - test_id={test_id}")

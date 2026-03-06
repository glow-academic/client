"""Internal test_start handler (new) — extends start.py with generation link.

Replaces test/start.py.

Differences from start.py:
  - If data contains generation_run_id, stores a Redis link
    generation_test_link:{test_id} → generation_run_id so generation_ended
    can look up the generation context after test grading completes.
  - All other logic is identical.
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.v5.socket.client.types import TestStartPayload
from app.routes.v5.socket.internal.test.types import (
    TestErrorData,
    TestProceedData,
)
from app.sql.types import StartTestSqlParams, StartTestSqlRow
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_START_TEST = "app/sql/queries/generate/test/start_test_complete.sql"


# NOTE: Not registered as @internal_sio.on("test_start") yet.
# To activate: import and swap registration with test/start.py.
async def test_start_handler_new(data: dict[str, Any]) -> None:
    """Handle test_start — create a new test, link generation if applicable."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id")
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = TestStartPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid test_start payload: {e}")
        return

    try:
        # Step 1: Create test via SQL function
        async with get_db_connection() as conn:
            row = cast(
                StartTestSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_START_TEST,
                    params=StartTestSqlParams(
                        p_profile_id=profile_id,
                        p_benchmark_id=payload.benchmark_id,
                        p_infinite_mode=payload.infinite_mode,
                    ),
                ),
            )

        if not row or not row.items:
            raise ValueError("Failed to create test")

        test_id = row.items[0].test_id

        # NEW: Link test_id → generation_run_id for generation resolution.
        generation_run_id = data.get("generation_run_id")
        if generation_run_id:
            try:
                redis = get_redis_client()
                if redis:
                    await redis.setex(
                        f"generation_test_link:{test_id}",
                        3600,
                        generation_run_id,
                    )
            except Exception:
                logger.warning(
                    f"Failed to store generation_test_link for test {test_id}"
                )

        # Step 2: Refresh MVs so the test is visible immediately
        async with get_db_connection() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")
        await invalidate_tags(["test", "tests", "benchmark"], redis=get_redis_client())

        # Step 3: Delegate to test_proceed
        await internal_sio.emit(
            "test_proceed",
            TestProceedData(
                sid=sid,
                test_id=str(test_id),
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in test_start: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to start test: {e}",
                error_type="start",
            ).model_dump(mode="json"),
        )

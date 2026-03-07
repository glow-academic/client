"""Internal test_start handler (new) — uses black-box entry functions.

Replaces test/start.py.

Differences from start.py:
  - Uses create_test (black box) instead of socket_start_test_v4 SQL function
  - Uses create_benchmark_test (black box) for optional benchmark bridge
  - benchmark_id is optional — generation resolution creates tests without one
  - If data contains generation_run_id, stores a Redis link
    generation_test_link:{test_id} → generation_run_id so generation_ended
    can look up the generation context after test grading completes.
  - profiles_id can be passed directly (from generation pipeline) or resolved
    from profile_id via profile_profiles_junction.
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
from app.routes.v5.tools.entries.benchmark_test.create import create_benchmark_test
from app.routes.v5.tools.entries.test.create import create_test
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_start")  # type: ignore
async def test_start_handler_new(data: dict[str, Any]) -> None:
    """Handle test_start — create test via black boxes, optional benchmark bridge."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id")
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
    except Exception as e:
        logger.exception(f"Invalid profile_id in test_start: {e}")
        return

    benchmark_id_raw = data.get("benchmark_id")
    benchmark_id = uuid.UUID(str(benchmark_id_raw)) if benchmark_id_raw else None
    infinite_mode = data.get("infinite_mode", False)

    # profiles_id: prefer propagated value, else resolve from profile_id
    profiles_id_str = data.get("profiles_id")
    session_id_str = data.get("session_id")

    try:
        async with get_db_connection() as conn:
            # Resolve profiles_id if not provided
            if profiles_id_str:
                profiles_id = uuid.UUID(profiles_id_str)
            else:
                profiles_id = await conn.fetchval(
                    """SELECT profile_id FROM profile_profiles_junction
                    WHERE profile_id = $1 AND active = true LIMIT 1""",
                    profile_id,
                )
                if profiles_id is None:
                    raise ValueError(
                        f"profiles_resource not found for profile_id {profile_id}"
                    )

            # Step 1: Create test entry (black box)
            result = await create_test(
                conn,
                profiles_id=profiles_id,
                infinite_mode=infinite_mode,
            )
            test_id = result.id

            # Step 2: Optional benchmark bridge (black box)
            if benchmark_id:
                session_id = (
                    uuid.UUID(session_id_str) if session_id_str else uuid.UUID(int=0)
                )
                await create_benchmark_test(
                    conn,
                    benchmark_id=benchmark_id,
                    test_id=test_id,
                    session_id=session_id,
                )

        # Step 3: Link test_id → generation_run_id for generation resolution
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

        # Step 4: Refresh MVs so the test is visible immediately
        async with get_db_connection() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")
        await invalidate_tags(["test", "tests", "benchmark"], redis=get_redis_client())

        # Step 5: Delegate to test_proceed
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

"""Test start handler.

Handles: test_start — create a new test for an eval.
Create-only mode: requires eval_id to create test + invocations.
"""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
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

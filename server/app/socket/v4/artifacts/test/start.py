"""Test lifecycle control plane.

Handles test_start event (client + internal). Create-only mode:
creates test + invocations via SQL, emits test_started, then auto-proceeds
to find the first pending run via test_next.

test_next event handles finding next pending run in existing test.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import (
    TestErrorEvent,
    TestNextPayload,
    TestStartedEvent,
    TestStartPayload,
)
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

client_router = APIRouter()
server_router = APIRouter()

SHOULD_PROCEED = True

SQL_PATH_CREATE_TEST = "app/sql/v4/queries/artifacts/test/create_test_complete.sql"
SQL_PATH_CREATE_INVOCATIONS = (
    "app/sql/v4/queries/generate/test/create_test_invocations_complete.sql"
)


async def _test_start_impl(
    sid: str, payload: TestStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle test_start - create a new test."""
    try:
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
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        message="Failed to create test",
                        error_type="create",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            test_id = row.test_id

            # Step 2: Create invocations
            inv_params = CreateTestInvocationsSqlParams(
                p_test_id=test_id,
                p_eval_id=payload.eval_id,
            )
            inv_row = cast(
                CreateTestInvocationsSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_CREATE_INVOCATIONS, params=inv_params
                ),
            )

            if not inv_row or not inv_row.chats:
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        message="Failed to create test invocations",
                        error_type="create",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Step 3: Refresh MVs
            await conn.execute("REFRESH MATERIALIZED VIEW test_invocation_mv")

        # Step 4: Invalidate caches
        await invalidate_tags(["test", "tests", "benchmark", "invocations"])

        # Step 5: Emit test_started to client
        event = TestStartedEvent(test_id=str(test_id))
        await sio.emit(
            "test_started",
            event.model_dump(mode="json"),
            room=sid,
        )

        logger.info(f"Test created - profile_id={profile_id}, test_id={test_id}")

        # Step 6: Auto-proceed if enabled — emit test_next internally
        if SHOULD_PROCEED:
            await internal_sio.emit(
                "test_next",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                },
            )

    except Exception as e:
        logger.exception(f"Error in test_start: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                message=f"Failed to start test: {str(e)}",
                error_type="internal",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_start(sid: str, data: dict[str, Any]) -> None:
    """Handle test_start event from client."""
    try:
        payload = TestStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _test_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in test_start: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                message=f"Invalid request: {str(e)}",
                error_type="validation",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("test_start")  # type: ignore
async def test_start_internal(data: dict[str, Any]) -> None:
    """Handle test_start from internal bus (auto-proceed)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = TestStartPayload(**data)
        await _test_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Error in test_start_internal: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/start", response_model=dict[str, bool])
async def test_start_api(request: TestStartPayload) -> dict[str, bool]:
    """Client-to-server event: Create a new test."""
    return {"success": True}


@client_router.post("/test/next", response_model=dict[str, bool])
async def test_next_api(request: TestNextPayload) -> dict[str, bool]:
    """Client-to-server event: Find next pending run in existing test."""
    return {"success": True}


@server_router.post("/test/started", response_model=dict[str, bool])
async def test_started_api(request: TestStartedEvent) -> dict[str, bool]:
    """Server-to-client event: Test created."""
    return {"success": True}

"""Test lifecycle control plane.

Handles test_start event (client + internal). Dual-mode:
- Create mode (has eval_id, no test_id): Create test + invocations via SQL,
  emit test_started, optionally auto-proceed to first run
- Next mode (has test_id): Find next invocation with pending runs,
  emit test_run internally or test_all_complete if done

Mirrors attempt/start.py pattern.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.test.get import get_test_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.test.run import _determine_next_run
from app.socket.v4.artifacts.test.types import (
    TestAllCompleteEvent,
    TestErrorEvent,
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
    """Handle test_start - create test or proceed to next pending run."""
    try:
        if payload.test_id is None:
            # === CREATE MODE ===
            if not payload.eval_id:
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        message="eval_id is required to create a test",
                        error_type="validation",
                    ).model_dump(mode="json"),
                    room=sid,
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
                await conn.execute("REFRESH MATERIALIZED VIEW mv_test_invocation")

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

            # Step 6: Auto-proceed if enabled
            if not SHOULD_PROCEED:
                return

            # Find first invocation with pending runs and emit test_run
            await _find_and_emit_next_run(sid, test_id)

        else:
            # === NEXT MODE ===
            test_id = payload.test_id
            await _find_and_emit_next_run(sid, test_id)

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
        next_run_resource_id, current_run, total_runs = _determine_next_run(
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
    """Client-to-server event: Start or proceed with a test."""
    return {"success": True}


@server_router.post("/test/started", response_model=dict[str, bool])
async def test_started_api(request: TestStartedEvent) -> dict[str, bool]:
    """Server-to-client event: Test created."""
    return {"success": True}

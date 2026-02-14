"""Test run all handler.

Handles the test_run_all WebSocket event to run ALL remaining auto-regressive replays.
Sequentially calls test_run for each pending run until complete.

Uses get_test_websocket() for validation (same pattern as run.py).
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.test.get import get_test_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.test.types import (
    TestAllCompleteEvent,
    TestErrorEvent,
    TestProgressEvent,
    TestRunAllPayload,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


async def _test_run_all_impl(
    sid: str, data: TestRunAllPayload, profile_id: uuid.UUID
) -> None:
    """Handle test run all with sequential execution.

    This function:
    1. Fetches test data via get_test_websocket()
    2. Finds target invocation and validates prerequisites
    3. Checks for pending runs
    4. Triggers test_run internally for the first pending run
    5. The complete handler will chain to next run
    """
    chat_id_str = str(data.chat_id)

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # Fetch test data via get_test_websocket()
        async with pool.acquire() as conn:
            result = await get_test_websocket(
                conn=conn,
                test_id=data.test_id,
                bypass_cache=True,
            )

        if not result.views or not result.views.benchmark_invocations:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="Failed to fetch test data",
                    error_type="context",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Find target invocation
        invocation = next(
            (
                inv
                for inv in result.views.benchmark_invocations
                if str(inv.invocation_id) == chat_id_str
            ),
            None,
        )

        if not invocation:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="Test chat does not exist",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Validate config exists
        if not result.resources or not (result.resources.agents or []):
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="No agent configuration found",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Determine pending runs
        total_runs = len(invocation.run_ids)
        completed_runs = len(invocation.invocation_run_ids)
        has_pending_runs = completed_runs < total_runs

        if not has_pending_runs:
            await sio.emit(
                "test_all_complete",
                TestAllCompleteEvent(
                    chat_id=chat_id_str,
                    total_runs=total_runs,
                    success=True,
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Emit progress event
        await sio.emit(
            "test_progress",
            TestProgressEvent(
                chat_id=chat_id_str,
                type="run_all_start",
                current_run=completed_runs + 1,
                total_runs=total_runs,
                message=f"Starting {total_runs - completed_runs} remaining runs",
            ).model_dump(mode="json"),
            room=sid,
        )

        # Trigger first run via internal bus with run_all flag
        await internal_sio.emit(
            "test_run",
            {
                "sid": sid,
                "chat_id": str(data.chat_id),
                "test_id": str(data.test_id),
                "run_all": True,
            },
        )

        logger.info(
            f"Test run all started - "
            f"profile_id={profile_id}, chat_id={data.chat_id}, "
            f"total_runs={total_runs}, completed={completed_runs}"
        )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in test_run_all: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=chat_id_str,
                message=f"Invalid UUID format: {str(e)}",
                error_type="validation",
            ).model_dump(mode="json"),
            room=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to run all tests: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=chat_id_str,
                message=f"Failed to run all tests: {str(e)}",
                error_type="internal",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_run_all(sid: str, data: dict[str, Any]) -> None:
    """Handle test_run_all event (client-to-server).

    Runs ALL remaining auto-regressive replays sequentially.
    Emits test_progress during execution, test_all_complete when done.
    """
    try:
        payload = TestRunAllPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=str(data.get("chat_id", "")),
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _test_run_all_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in test_run_all: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=str(data.get("chat_id", "")),
                message=f"Invalid request: {str(e)}",
                error_type="validation",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/run_all", response_model=dict[str, bool])
async def test_run_all_api(request: TestRunAllPayload) -> dict[str, bool]:
    """Client-to-server event: Run all remaining auto-regressive replays."""
    return {"success": True}


@server_router.post("/test/all_complete", response_model=dict[str, bool])
async def test_all_complete_api(request: TestAllCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: All test runs completed."""
    return {"success": True}

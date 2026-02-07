"""Test run all handler.

Handles the test_run_all WebSocket event to run ALL remaining auto-regressive replays.
Sequentially calls test_run for each pending run until complete.

Entry types: ['replays'] - Replay response tools
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.permissions import (
    TestRunContext,
    format_generation_error,
    validate_test_run_access,
)
from app.socket.v4.artifacts.test.types import (
    TestAllCompleteEvent,
    TestErrorEvent,
    TestProgressEvent,
    TestRunAllPayload,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL path for context
SQL_PATH_CONTEXT = "app/sql/v4/queries/generate/test/get_test_run_context_complete.sql"


async def _test_run_all_impl(
    sid: str, data: TestRunAllPayload, profile_id: uuid.UUID
) -> None:
    """Handle test run all with sequential execution.

    This function:
    1. Validates the first run can proceed
    2. Emits test_progress with status
    3. Triggers test_run internally for the first pending run
    4. The complete handler will chain to next run

    Note: Actual sequential execution is handled by the complete handler
    which checks if there are more pending runs and emits test_run internally.
    """
    chat_id_str = str(data.chat_id)

    try:
        async with get_db_connection() as conn:
            # Fetch context to validate we can start
            context_row = await execute_sql_typed(
                conn,
                SQL_PATH_CONTEXT,
                params={
                    "p_profile_id": profile_id,
                    "p_chat_id": data.chat_id,
                },
            )

            if not context_row:
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        chat_id=chat_id_str,
                        message="Failed to fetch test context",
                        error_type="context",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Build context dataclass for validation
            ctx = TestRunContext(
                agent_exists=getattr(context_row, "agent_exists", False) or False,
                agent_name=getattr(context_row, "agent_name", None),
                agent_is_active=getattr(context_row, "agent_is_active", False) or False,
                model_id=getattr(context_row, "model_id", None),
                model_name=getattr(context_row, "model_name", None),
                provider_id=getattr(context_row, "provider_id", None),
                provider_name=getattr(context_row, "provider_name", None),
                has_api_key=getattr(context_row, "has_api_key", False) or False,
                requests_per_day=getattr(context_row, "requests_per_day", None),
                runs_today=getattr(context_row, "runs_today", 0) or 0,
                chat_id=getattr(context_row, "chat_id", None),
                chat_exists=getattr(context_row, "chat_exists", False) or False,
                chat_is_active=getattr(context_row, "chat_is_active", False) or False,
                attempt_id=getattr(context_row, "attempt_id", None),
                attempt_exists=getattr(context_row, "attempt_exists", False) or False,
                group_id=getattr(context_row, "group_id", None),
                group_exists=getattr(context_row, "group_exists", False) or False,
                has_pending_runs=getattr(context_row, "has_pending_runs", False)
                or False,
                next_run_resource_id=getattr(context_row, "next_run_resource_id", None),
                total_runs=getattr(context_row, "total_runs", 0) or 0,
                completed_runs=getattr(context_row, "completed_runs", 0) or 0,
                rubric_id=getattr(context_row, "rubric_id", None),
            )

            # Validate
            is_valid, failures = validate_test_run_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Test run all validation failed - "
                    f"profile_id={profile_id}, chat_id={data.chat_id}, "
                    f"reason: {error_msg}"
                )
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        chat_id=chat_id_str,
                        message=f"Cannot run all tests: {error_msg}",
                        error_type="validation",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Check if there are no pending runs
            if not ctx.has_pending_runs:
                await sio.emit(
                    "test_all_complete",
                    TestAllCompleteEvent(
                        chat_id=chat_id_str,
                        total_runs=ctx.total_runs,
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
                    current_run=ctx.completed_runs + 1,
                    total_runs=ctx.total_runs,
                    message=f"Starting {ctx.total_runs - ctx.completed_runs} remaining runs",
                ).model_dump(mode="json"),
                room=sid,
            )

            # Store run_all flag in room state so complete handler knows to continue
            # We use a simple approach: emit to internal bus with run_all=True
            await internal_sio.emit(
                "test_run",
                {
                    "sid": sid,
                    "chat_id": str(data.chat_id),
                    "run_all": True,  # Flag for complete handler
                },
            )

            logger.info(
                f"Test run all started - "
                f"profile_id={profile_id}, chat_id={data.chat_id}, "
                f"total_runs={ctx.total_runs}, completed={ctx.completed_runs}"
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

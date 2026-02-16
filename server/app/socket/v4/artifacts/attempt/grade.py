"""Attempt simulation grade handler — thin wrapper.

Handles the attempt_grade WebSocket event to complete a simulation and trigger grading.
Validates context, resolves chat_id, creates grade entry + run via prepare SQL,
then delegates to attempt_generate for the LLM pipeline.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    ATTEMPT_GRADE_ENTRY_TYPES,
    AttemptGradedEvent,
    AttemptGradePayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetAttemptGradeContextSqlParams,
    GetAttemptGradeContextSqlRow,
    PrepareAttemptGradeSqlParams,
    PrepareAttemptGradeSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_attempt_grade_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_grade_complete.sql"
)


async def _attempt_grade_impl(
    sid: str, data: AttemptGradePayload, profile_id: uuid.UUID
) -> None:
    """Thin wrapper: validate, prepare grade, delegate to attempt_generate."""
    try:
        # 1. Context SQL — validate access, rate limits, resolve chat_id + group_id
        async with get_db_connection() as conn:
            context_params = GetAttemptGradeContextSqlParams(
                p_profile_id=profile_id,
                p_simulation_id=data.simulation_id,
                p_attempt_id=data.attempt_id,
            )
            context_row = cast(
                GetAttemptGradeContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            if not context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to fetch grade context",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        # Validate simulation access
        if not context_row.simulation_exists:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Simulation does not exist",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        if not context_row.attempt_exists:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Attempt does not exist",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Check cohort access (skip if attempt exists — implies access was granted)
        if not context_row.profile_has_access and not context_row.attempt_exists:
            sim_name = context_row.simulation_name or "unknown"
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"You do not have access to simulation '{sim_name}'",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Rate limit validation
        requests_per_day = context_row.requests_per_day
        runs_today = context_row.runs_today or 0

        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"Attempt grade rate limit exceeded - "
                f"profile_id={profile_id}, attempt_id={data.attempt_id}, "
                f"reason: {error_msg}"
            )
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Cannot grade attempt: {error_msg}",
                    artifact_type="attempt",
                    group_id=str(context_row.group_id)
                    if context_row.group_id
                    else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # 2. Resolve chat_id from context SQL (or use payload)
        chat_id = data.chat_id or context_row.chat_id
        group_id = context_row.group_id

        if not group_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No group found for this attempt",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        if not chat_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No chat found for this attempt",
                    artifact_type="attempt",
                    group_id=str(group_id),
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # 3. Prepare SQL — create grade + run
        async with get_db_connection() as conn:
            prepare_params = PrepareAttemptGradeSqlParams(
                p_profile_id=profile_id,
                p_group_id=group_id,
                p_chat_id=chat_id,
            )
            prepare_row = cast(
                PrepareAttemptGradeSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row or not prepare_row.run_id:
                logger.error(
                    f"Attempt grade preparation failed - "
                    f"profile_id={profile_id}, "
                    f"attempt_id={data.attempt_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare grading",
                        artifact_type="attempt",
                        group_id=str(group_id),
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        # 4. Delegate to attempt_generate
        await internal_sio.emit(
            "attempt_generate",
            {
                "sid": sid,
                "attempt_id": str(data.attempt_id),
                "entry_types": ATTEMPT_GRADE_ENTRY_TYPES,
                "run_id": str(prepare_row.run_id),
                "group_id": str(group_id),
                "chat_id": str(chat_id),
                "grade_id": str(prepare_row.grade_id) if prepare_row.grade_id else None,
            },
        )

        logger.info(
            f"Attempt grade initiated - "
            f"profile_id={profile_id}, attempt_id={data.attempt_id}, "
            f"run_id={prepare_row.run_id}, grade_id={prepare_row.grade_id}"
        )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in attempt_grade: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid UUID format: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to grade attempt: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to grade attempt: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def attempt_grade(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_grade event (client-to-server)."""
    try:
        payload = AttemptGradePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _attempt_grade_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_grade: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )


@internal_sio.on("attempt_grade")  # type: ignore
async def attempt_grade_internal(data: dict[str, Any]) -> None:
    """Handle attempt_grade event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptGradePayload(**data)
        await _attempt_grade_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_grade_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid request: {str(e)}",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/grade", response_model=dict[str, bool])
async def attempt_grade_api(request: AttemptGradePayload) -> dict[str, bool]:
    """Client-to-server event: Grade simulation attempt."""
    return {"success": True}


@server_router.post("/attempt/graded", response_model=dict[str, bool])
async def attempt_graded_api(request: AttemptGradedEvent) -> dict[str, bool]:
    """Server-to-client event: Simulation grading completed."""
    return {"success": True}

"""Attempt simulation grade handler.

Handles the attempt_grade WebSocket event to complete a simulation and trigger grading.
Creates grade entry + run and routes to generate_artifact handler for grading.

Entry types: ['grades', 'feedbacks'] - Grading tools
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.permissions import (
    AttemptGenerationContext,
    format_generation_error,
    validate_attempt_grade_access,
)
from app.socket.v4.artifacts.attempt.resolve_agent import resolve_agent_for_entry_types
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
SQL_PATH_CONTEXT = "app/sql/v4/queries/generate/attempt/get_attempt_grade_context_complete.sql"
SQL_PATH_PREPARE = "app/sql/v4/queries/generate/attempt/prepare_attempt_grade_complete.sql"


async def _attempt_grade_impl(
    sid: str, data: AttemptGradePayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt grade with all business logic.

    This function:
    1. Fetches context and validates prerequisites
    2. Creates grade entry + run
    3. Fetches full attempt data from views (messages, rubric)
    4. Builds jinja context with full simulation context
    5. Emits to generate_artifact handler with grading tools
    6. Completion handler will emit attempt_graded
    """
    try:
        async with get_db_connection() as conn:
            # Step 0: Resolve agent_id from agent_ids list
            resolution = await resolve_agent_for_entry_types(
                conn, data.agent_ids, ATTEMPT_GRADE_ENTRY_TYPES
            )
            if not resolution.success:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=resolution.error_message or "Failed to resolve agent",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return
            resolved_agent_id = resolution.agent_id

            # Step 1: Fetch context and validate prerequisites
            context_params = GetAttemptGradeContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=resolved_agent_id,
                p_simulation_id=data.simulation_id,
                p_attempt_id=data.attempt_id,
                p_entry_types=ATTEMPT_GRADE_ENTRY_TYPES,
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

            # Build context dataclass for validation
            ctx = AttemptGenerationContext(
                # Base GenerationContext fields
                agent_exists=context_row.agent_exists or False,
                agent_name=context_row.agent_name,
                agent_is_active=context_row.agent_is_active or False,
                model_id=context_row.model_id,
                model_name=context_row.model_name,
                provider_id=context_row.provider_id,
                provider_name=context_row.provider_name,
                has_api_key=context_row.has_api_key or False,
                requests_per_day=context_row.requests_per_day,
                runs_today=context_row.runs_today or 0,
                # Attempt-specific fields
                simulation_exists=context_row.simulation_exists or False,
                simulation_is_active=context_row.simulation_is_active or False,
                simulation_id=context_row.simulation_id,
                simulation_name=context_row.simulation_name,
                profile_has_access=context_row.profile_has_access or False,
                attempt_exists=context_row.attempt_exists or False,
                attempt_id=context_row.attempt_id,
                requested_entry_types=ATTEMPT_GRADE_ENTRY_TYPES,
                valid_entry_types=context_row.valid_entry_types or [],
            )

            # Validate using business logic
            is_valid, failures = validate_attempt_grade_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Attempt grade validation failed - "
                    f"profile_id={profile_id}, attempt_id={data.attempt_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Cannot grade attempt: {error_msg}",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

            # Step 2: Create grade entry + run
            prepare_params = PrepareAttemptGradeSqlParams(
                p_profile_id=profile_id,
                p_agent_id=resolved_agent_id,
                p_attempt_id=data.attempt_id,
                p_chat_id=data.chat_id,
                p_entry_types=ATTEMPT_GRADE_ENTRY_TYPES,
            )

            prepare_row = cast(
                PrepareAttemptGradeSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row or not prepare_row.run_id:
                logger.error(
                    f"Attempt grade preparation failed - "
                    f"profile_id={profile_id}, attempt_id={data.attempt_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare grading",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

            run_id = str(prepare_row.run_id)
            group_id = str(prepare_row.group_id) if prepare_row.group_id else None
            grade_id = str(prepare_row.grade_id) if prepare_row.grade_id else None
            trace_id = prepare_row.trace_id

            # Step 3: Build model config
            model_config = {
                "model": prepare_row.model_name,
                "api_key": prepare_row.api_key,
                "base_url": prepare_row.base_url,
                "temperature": prepare_row.temperature,
                "reasoning": prepare_row.reasoning,
                "provider": prepare_row.provider_name,
                "voice": None,
                "quality": None,
                "length_seconds": None,
                "tool_choice": "required",  # Force tool calls for grading
            }

            # Step 4: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=prepare_row.developer_instruction_templates,
                jinja_context=prepare_row.jinja_context,
            )

            # Step 5: Build messages array
            messages: list[dict[str, str]] = []

            # Add system prompt
            if prepare_row.system_prompt:
                messages.append({"role": "system", "content": prepare_row.system_prompt})

            # Add rendered developer instructions (contains rubric, messages, etc.)
            for dm in rendered_developer_messages:
                messages.append({"role": "developer", "content": dm})

            # Step 6: Emit to generate_artifact handler with grading tools
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "attempt",
                    "resource_type": "grade",
                    "modality": "call",
                    "run_id": run_id,
                    "group_id": group_id,
                    "attempt_id": str(data.attempt_id),
                    "chat_id": str(data.chat_id) if data.chat_id else None,
                    "grade_id": grade_id,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": model_config,
                    "tools": convert_tools_to_dict(prepare_row.tools),
                    "metadata": {
                        "trace_id": trace_id,
                        "simulation_id": str(data.simulation_id),
                    },
                    "eval_mode": False,
                },
            )

            logger.info(
                f"Attempt grade initiated - "
                f"profile_id={profile_id}, attempt_id={data.attempt_id}, "
                f"run_id={run_id}, grade_id={grade_id}"
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
    """Handle attempt_grade event (client-to-server).

    Grades the simulation attempt.
    Emits attempt_graded on completion, attempt_error on failure.
    """
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

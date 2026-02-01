"""Training simulation start handler.

Handles the training_start WebSocket event to initiate a new training session.
Creates attempt + chat entries. If scenario needs generation, emits to
scenario_generate handler internally.

Entry types: ['chats'] - Creates attempt and chat only
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.permissions import (
    TrainingGenerationContext,
    check_scenario_needs_generation,
    format_generation_error,
    validate_training_access,
)
from app.socket.v4.artifacts.training.types import (
    TRAINING_START_ENTRY_TYPES,
    TrainingStartedEvent,
    TrainingStartPayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetTrainingStartContextSqlParams,
    GetTrainingStartContextSqlRow,
    PrepareTrainingStartSqlParams,
    PrepareTrainingStartSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_CONTEXT = "app/sql/v4/queries/generate/training/get_training_start_context_complete.sql"
SQL_PATH_PREPARE_START = "app/sql/v4/queries/generate/training/prepare_training_start_complete.sql"


async def _training_start_impl(
    sid: str, data: TrainingStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle training start with all business logic.

    This function:
    1. Fetches context and validates prerequisites
    2. Checks if scenario needs generation
    3. If needs generation -> emits scenario_generate internally
    4. Creates attempt + chat entries
    5. Emits training_started event with scenario data
    """
    try:
        async with get_db_connection() as conn:
            # Step 1: Fetch context and validate prerequisites
            context_params = GetTrainingStartContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=data.agent_id,
                p_simulation_id=data.simulation_id,
                p_scenario_id=data.scenario_id,
                p_entry_types=TRAINING_START_ENTRY_TYPES,
            )

            context_row = cast(
                GetTrainingStartContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            if not context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to fetch generation context",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Build context dataclass for validation
            ctx = TrainingGenerationContext(
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
                # Training-specific fields
                simulation_exists=context_row.simulation_exists or False,
                simulation_is_active=context_row.simulation_is_active or False,
                simulation_id=context_row.simulation_id,
                simulation_name=context_row.simulation_name,
                profile_has_access=context_row.profile_has_access or False,
                has_problem_statement=context_row.has_problem_statement or False,
                has_persona=context_row.has_persona or False,
                requested_entry_types=TRAINING_START_ENTRY_TYPES,
                valid_entry_types=context_row.valid_entry_types or [],
            )

            # Validate using business logic
            is_valid, failures = validate_training_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Training start validation failed - "
                    f"profile_id={profile_id}, simulation_id={data.simulation_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Cannot start training: {error_msg}",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Step 2: Check if scenario needs generation
            scenario_id = data.scenario_id or context_row.scenario_id
            needs_gen = check_scenario_needs_generation(ctx)

            if needs_gen and scenario_id:
                # Emit to existing scenario_generate handler
                await internal_sio.emit(
                    "scenario_generate",
                    {
                        "sid": sid,
                        "scenario_id": str(scenario_id),
                        "agent_id": str(data.agent_id),
                        "agent_type": "content",
                        "resource_types": ["problem_statements", "objectives", "personas"],
                    },
                )
                logger.info(
                    f"Triggered scenario generation - scenario_id={scenario_id}"
                )

            # Step 3: Create attempt + chat entries
            prepare_params = PrepareTrainingStartSqlParams(
                p_profile_id=profile_id,
                p_simulation_id=data.simulation_id,
                p_scenario_id=scenario_id,
            )

            prepare_row = cast(
                PrepareTrainingStartSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_PREPARE_START, params=prepare_params
                ),
            )

            if not prepare_row or not prepare_row.attempt_id:
                logger.error(
                    f"Training start preparation failed - "
                    f"profile_id={profile_id}, simulation_id={data.simulation_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create training attempt",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Step 4: Build scenario data from context
            scenario_data = None
            if scenario_id:
                scenario_data = {
                    "problem_statement": context_row.problem_statement,
                    "objectives": context_row.objectives,
                    "persona": context_row.persona,
                    "video_ids": context_row.video_ids,
                    "image_ids": context_row.image_ids,
                }

            # Step 5: Emit training_started event
            started_event = TrainingStartedEvent(
                simulation_id=str(data.simulation_id),
                attempt_id=str(prepare_row.attempt_id),
                chat_id=str(prepare_row.chat_id),
                scenario_id=str(prepare_row.scenario_id) if prepare_row.scenario_id else None,
                scenario_data=scenario_data,
            )

            await sio.emit(
                "training_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            logger.info(
                f"Training session started - "
                f"profile_id={profile_id}, simulation_id={data.simulation_id}, "
                f"attempt_id={prepare_row.attempt_id}, chat_id={prepare_row.chat_id}"
            )

    except Exception as e:
        logger.exception(f"Failed to start training session: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to start training: {str(e)}",
                artifact_type="training",
                group_id=None,
                resource_type="training",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def training_start(sid: str, data: dict[str, Any]) -> None:
    """Handle training_start event (client-to-server).

    Starts a new training session. Creates attempt + chat entries.
    Emits training_started on success, training_error on failure.
    """
    try:
        payload = TrainingStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="training",
                    group_id=None,
                    resource_type="training",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _training_start_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in training_start: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="training",
                group_id=None,
                resource_type="training",
            ),
            sid=sid,
        )


@internal_sio.on("training_start")  # type: ignore
async def training_start_internal(data: dict[str, Any]) -> None:
    """Handle training_start event from internal bus (server-to-server)."""
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
                    artifact_type="training",
                    group_id=None,
                    resource_type="training",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = TrainingStartPayload(**data)
        await _training_start_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in training_start_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid request: {str(e)}",
                    artifact_type="training",
                    group_id=None,
                    resource_type="training",
                ),
                sid=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/training/start", response_model=dict[str, bool])
async def training_start_api(request: TrainingStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a new training session."""
    return {"success": True}


@server_router.post("/training/started", response_model=dict[str, bool])
async def training_started_api(request: TrainingStartedEvent) -> dict[str, bool]:
    """Server-to-client event: Training session created successfully."""
    return {"success": True}

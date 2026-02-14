"""Training simulation start handler.

Handles the training_start WebSocket event with full orchestration:
- Fetches context and validates prerequisites
- Determines if generation is needed (internal)
- If generation needed: prepares generation, renders Jinja, emits generate_artifact
- If no generation needed: sets up scope, emits attempt_chat internally

Chat creation is handled by attempt/chat.py via the attempt_chat internal event.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.training.get import get_training_websocket
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
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
    TrainingStartedEvent,
    TrainingStartPayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    PrepareTrainingGenerationSqlParams,
    PrepareTrainingGenerationSqlRow,
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
SQL_PATH_PREPARE_START = (
    "app/sql/v4/queries/generate/training/prepare_training_start_complete.sql"
)
SQL_PATH_PREPARE_GENERATION = (
    "app/sql/v4/queries/generate/training/prepare_training_generation_complete.sql"
)

# Resource types for training generation
TRAINING_RESOURCE_TYPES = ["problem_statements", "objectives", "personas"]


async def _training_start_impl(
    sid: str, data: TrainingStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle training start with full orchestration.

    Flow:
    1. Fetch training context (simulation, scenario data)
    2. Validate prerequisites
    3. Determine if generation is needed (internal - not exposed)
    4. IF generation needed:
       a. Prepare generation (SQL creates run/group, returns context)
       b. Render developer instructions with Jinja
       c. Emit generate_artifact (internal) with artifact_type="training"
       d. Return - complete.py will finish the flow
    5. IF no generation needed:
       a. Set up training_bundle_dept scope (SQL)
       b. Emit attempt_chat internally - chat.py finishes the flow
    """
    try:
        async with get_db_connection() as conn:
            # Resolve department_id if not provided (use profile's primary department)
            resolved_department_id = data.department_id
            if not resolved_department_id:
                resolved_department_id = await conn.fetchval(
                    """
                    SELECT pdj.departments_id
                    FROM profile_departments_junction pdj
                    WHERE pdj.profile_id = $1
                      AND pdj.active = true
                      AND pdj.is_primary = true
                    LIMIT 1
                    """,
                    profile_id,
                )
                if not resolved_department_id:
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="No primary department found for this profile.",
                            artifact_type="training",
                            group_id=None,
                            resource_type="training",
                        ),
                        sid=sid,
                    )
                    return

            # Step 1: Fetch context and validate prerequisites
            training_ws = await get_training_websocket(
                conn=conn,
                profile_id=profile_id,
                training_bundle_entry_id=data.training_bundle_entry_id,
                department_id=resolved_department_id,
                draft_id=data.draft_id,
            )
            context_row = training_ws.resources

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
                simulation_name=getattr(context_row, "simulation_name", None),
                profile_has_access=context_row.profile_has_access or False,
                has_problem_statement=context_row.has_problem_statement or False,
                has_persona=context_row.has_persona or False,
                requested_entry_types=[],
                valid_entry_types=context_row.valid_entry_types or [],
            )

            # Validate using business logic
            is_valid, failures = validate_training_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Training start validation failed - "
                    f"profile_id={profile_id}, training_bundle_entry_id={data.training_bundle_entry_id}, "
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

            # Step 2: Check if scenario needs generation (internal decision)
            scenario_id = context_row.scenario_id
            if not context_row.simulation_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Missing simulation scope for selected training bundle",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return
            needs_gen = check_scenario_needs_generation(ctx)

            if needs_gen and scenario_id:
                # =============================================
                # GENERATION PATH - prepare and emit internally
                # =============================================
                logger.info(
                    f"Training needs generation - "
                    f"scenario_id={scenario_id}, "
                    f"has_problem_statement={ctx.has_problem_statement}, "
                    f"has_persona={ctx.has_persona}"
                )

                # Call prepare_training_generation SQL
                gen_params = PrepareTrainingGenerationSqlParams(
                    p_profile_id=profile_id,
                    p_training_bundle_entry_id=data.training_bundle_entry_id,
                    p_department_id=resolved_department_id,
                    p_draft_id=data.draft_id,
                    p_resource_types=TRAINING_RESOURCE_TYPES,
                )

                gen_row = cast(
                    PrepareTrainingGenerationSqlRow,
                    await execute_sql_typed(
                        conn, SQL_PATH_PREPARE_GENERATION, params=gen_params
                    ),
                )

                if not gen_row or not gen_row.run_id:
                    logger.error(
                        f"Training generation preparation failed - "
                        f"profile_id={profile_id}, training_bundle_entry_id={data.training_bundle_entry_id}"
                    )
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to prepare training generation",
                            artifact_type="training",
                            group_id=None,
                            resource_type="training",
                        ),
                        sid=sid,
                    )
                    return

                # Render developer instructions with Jinja
                rendered_developer_messages = render_developer_instructions(
                    templates=gen_row.developer_instruction_templates,
                    jinja_context=gen_row.jinja_context,
                )

                # Build messages for LLM
                messages: list[dict[str, str]] = []
                if gen_row.system_prompt:
                    messages.append(
                        {"role": "system", "content": gen_row.system_prompt}
                    )
                for dev_msg in rendered_developer_messages:
                    messages.append({"role": "developer", "content": dev_msg})
                if data.user_instructions:
                    for instruction in data.user_instructions:
                        messages.append({"role": "user", "content": instruction})

                # Emit generate_artifact; complete handler can resolve the rest.
                await internal_sio.emit(
                    "generate_artifact",
                    {
                        "sid": sid,
                        "artifact_type": "training",
                        "resource_type": TRAINING_RESOURCE_TYPES[0],
                        "run_id": str(gen_row.run_id),
                        "group_id": str(gen_row.group_id) if gen_row.group_id else None,
                        "message_id": None,
                        "messages": messages,
                        "llm_config": {
                            "model": gen_row.model_name,
                            "api_key": gen_row.api_key,
                            "base_url": gen_row.base_url,
                            "temperature": gen_row.temperature,
                            "reasoning": gen_row.reasoning,
                            "provider": gen_row.provider_name,
                            "voice": None,
                            "quality": None,
                            "length_seconds": None,
                            "tool_choice": "required",  # Force tool calls
                        },
                        "tools": convert_tools_to_dict(gen_row.tools),
                        "simulation_id": str(context_row.simulation_id),
                        "training_bundle_entry_id": str(data.training_bundle_entry_id),
                        "department_id": str(resolved_department_id),
                        "draft_id": str(data.draft_id) if data.draft_id else None,
                        "attempt_id": str(data.attempt_id) if data.attempt_id else None,
                        # Training-specific field for filtering
                        "scenario_id": str(scenario_id),
                    },
                )

                logger.info(
                    f"Training generation started - "
                    f"run_id={gen_row.run_id}, "
                    f"group_id={gen_row.group_id}, "
                    f"scenario_id={scenario_id}"
                )
                # Return - complete.py will handle the rest
                return

            # =============================================
            # NO GENERATION PATH - set up scope, emit attempt_chat
            # =============================================

            # Step 3: Set up training_bundle_dept scope
            prepare_params = PrepareTrainingStartSqlParams(
                p_profile_id=profile_id,
                p_training_bundle_entry_id=data.training_bundle_entry_id,
                p_department_id=resolved_department_id,
                p_draft_id=data.draft_id,
            )

            prepare_row = cast(
                PrepareTrainingStartSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_PREPARE_START, params=prepare_params
                ),
            )

            if not prepare_row or not prepare_row.training_bundle_department_id:
                logger.error(
                    f"Training start preparation failed - "
                    f"profile_id={profile_id}, training_bundle_entry_id={data.training_bundle_entry_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare training scope",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            if not data.attempt_id:
                logger.error(
                    f"No attempt_id provided - "
                    f"profile_id={profile_id}, training_bundle_entry_id={data.training_bundle_entry_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Missing attempt_id for training start",
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

            # Step 5: Emit attempt_chat internally - chat.py finishes the flow
            await internal_sio.emit(
                "attempt_chat",
                {
                    "sid": sid,
                    "profile_id": str(profile_id),
                    "attempt_id": str(data.attempt_id),
                    "training_bundle_department_id": str(
                        prepare_row.training_bundle_department_id
                    ),
                    "simulation_id": str(context_row.simulation_id),
                    "scenario_id": str(prepare_row.scenario_id)
                    if prepare_row.scenario_id
                    else None,
                    "scenario_data": scenario_data,
                    "previous_chat_map": data.previous_chat_map,
                },
            )

            logger.info(
                f"Training start scope prepared (no generation) - "
                f"profile_id={profile_id}, simulation_id={context_row.simulation_id}, "
                f"training_bundle_department_id={prepare_row.training_bundle_department_id}"
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

    Starts a new training session. Server handles everything internally:
    - Checks if scenario needs generation
    - If generation needed, runs it and streams progress
    - Creates attempt + chat entries
    - Emits training_started when ready
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

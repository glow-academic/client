"""Attempt simulation grade handler.

Handles the attempt_grade WebSocket event to complete a simulation and trigger grading.
Creates grade entry + run and routes to generate_artifact handler for grading.

Follows the persona generation pattern:
1. get_attempt_websocket() resolves config chain (agent/model/provider)
2. Python validates prerequisites and extracts LLM config
3. Parallel fetch for tools/prompts/instructions
4. Slim SQL handles mutations only (run/config/grade creation)
5. Jinja rendering in Python
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.api.v4.artifacts.attempt.types import GetAttemptWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.attempt.types import (
    ATTEMPT_GRADE_ENTRY_TYPES,
    AttemptGradedEvent,
    AttemptGradePayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetAgentEntryToolsSqlParams,
    GetAgentEntryToolsSqlRow,
    GetAttemptGradeContextSqlParams,
    GetAttemptGradeContextSqlRow,
    PrepareAttemptGradeSqlParams,
    PrepareAttemptGradeSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

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
SQL_PATH_AGENT_ENTRY_TOOLS = (
    "app/sql/v4/queries/generate/attempt/get_agent_entry_tools_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


def _build_attempt_jinja_context(
    result: GetAttemptWebsocketResponse,
) -> dict[str, Any]:
    """Build Jinja context with resources as top-level variables.

    Resources are the current selections (from get_attempt_internal's config chain).
    Templates access resources directly: {{ rubrics }}, {{ agents[0].temperature }}
    Views (e.g. simulation_messages) are injected separately after prepare.
    """
    if result.resources:
        return result.resources.model_dump(mode="json")
    return {}


async def _attempt_grade_impl(
    sid: str, data: AttemptGradePayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt grade with all business logic.

    This function:
    1. Fetches attempt data via get_attempt_websocket() (cached, includes config chain)
    2. Extracts LLM config from pre-fetched resources (agent/model/provider)
    3. Validates prerequisites (agent, model, provider, API key)
    4. Checks rate limit and simulation access via simplified context SQL
    5. Resolves chat_id and group_id from websocket data
    6. Parallel fetches tools, prompts, and instructions
    7. Calls slim prepare SQL (mutations only: run/config/grade creation)
    8. Builds jinja context in Python from views + resources
    9. Renders developer instructions and persists messages
    10. Emits to generate_artifact handler with grading tools
    """
    try:
        # Step 1: Fetch attempt data (includes pre-fetched config resources)
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async with pool.acquire() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=data.attempt_id,
            )

        if not result.resources:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Failed to fetch attempt data",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Get agent_id from resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = resource_agent_ids.get("primary")

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for this attempt",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 2: Extract LLM config from pre-fetched resources
        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        # Validate: agent resource must exist
        if not agent_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configuration found. Check simulation settings.",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Validate: model resource must exist
        if not model_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Agent '{agent_resource.name}' has no model configured",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Validate: provider resource must exist
        if not provider_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Model '{model_resource.name}' has no provider configured",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Extract LLM config fields from resources
        model_name = (
            model_resource.value
            if hasattr(model_resource, "value")
            else model_resource.name
        )
        base_url = (
            provider_resource.endpoint if hasattr(provider_resource, "endpoint") else ""
        )
        api_key = provider_resource.key if hasattr(provider_resource, "key") else ""
        temperature = (
            agent_resource.temperature
            if hasattr(agent_resource, "temperature")
            else 0.0
        )
        reasoning = (
            agent_resource.reasoning if hasattr(agent_resource, "reasoning") else None
        )
        provider_name = provider_resource.value or provider_resource.name or ""

        # Validate: API key must exist
        if not api_key:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"No API key configured for provider '{provider_name}'",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 3: Check rate limit + simulation access (the only things still in SQL)
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
                error_msg = f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
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
                        group_id=str(result.group_id) if result.group_id else None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        # Step 4: Parallel fetch tools, prompts, and instructions
        async with get_db_connection() as conn:

            async def fetch_tools():
                async with pool.acquire() as c:
                    tools_params = GetAgentEntryToolsSqlParams(
                        p_agent_id=agent_id,
                        p_entry_types=ATTEMPT_GRADE_ENTRY_TYPES,
                    )
                    tools_row = cast(
                        GetAgentEntryToolsSqlRow,
                        await execute_sql_typed(
                            c, SQL_PATH_AGENT_ENTRY_TOOLS, params=tools_params
                        ),
                    )
                    return tools_row.tools if tools_row else []

            async def fetch_system_prompt():
                prompt_id = (
                    agent_resource.prompt_id
                    if hasattr(agent_resource, "prompt_id")
                    else None
                )
                if not prompt_id:
                    return ""
                async with pool.acquire() as c:
                    prompts = await get_prompts_internal(c, [prompt_id])
                    if prompts and prompts[0].system_prompt:
                        return prompts[0].system_prompt
                    return ""

            async def fetch_developer_instructions():
                instruction_ids = (
                    agent_resource.instruction_ids
                    if hasattr(agent_resource, "instruction_ids")
                    else []
                )
                if not instruction_ids:
                    return []
                async with pool.acquire() as c:
                    instructions = await get_instructions_internal(c, instruction_ids)
                    return [inst.template for inst in instructions if inst.template]

            (
                tools,
                system_prompt,
                developer_instruction_templates,
            ) = await asyncio.gather(
                fetch_tools(),
                fetch_system_prompt(),
                fetch_developer_instructions(),
            )

            # Step 5: Resolve chat_id and group_id from websocket data
            group_id = result.group_id
            chat_id = data.chat_id
            if not chat_id and result.views and result.views.simulation_chats:
                # Use first chat from attempt (sorted by created_at)
                chat_id = result.views.simulation_chats[0].id

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

            # Step 6: Prepare grade (mutations only: run/config/grade)
            prepare_params = PrepareAttemptGradeSqlParams(
                p_profile_id=profile_id,
                p_group_id=group_id,
                p_chat_id=chat_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
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

            run_id = prepare_row.run_id
            grade_id = prepare_row.grade_id

            # Step 7: Build jinja context from resources + views (persona pattern)
            jinja_context = _build_attempt_jinja_context(result)

            # Inject views into jinja context for template access
            views_data: dict[str, Any] = {}
            if result.views:
                if result.views.simulation_attempts:
                    views_data["simulation_attempts"] = [
                        a.model_dump(mode="json")
                        for a in result.views.simulation_attempts
                    ]
                if result.views.simulation_chats:
                    views_data["simulation_chats"] = [
                        c.model_dump(mode="json") for c in result.views.simulation_chats
                    ]
                if result.views.simulation_messages:
                    views_data["simulation_messages"] = [
                        m.model_dump(mode="json")
                        for m in result.views.simulation_messages
                    ]
            jinja_context["views"] = views_data

            # Inject grade data (created by prepare SQL, not in websocket response)
            jinja_context["grade"] = {
                "id": str(grade_id) if grade_id else None,
            }

            # Step 8: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 9: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            # Insert system prompt
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                await conn.fetchval(
                    create_message_sql,
                    run_id,
                    "system",
                    system_prompt,
                    True,
                    False,
                )

            # Insert developer instructions
            for m in rendered_developer_messages:
                messages.append({"role": "developer", "content": m})
                await conn.fetchval(
                    create_message_sql,
                    run_id,
                    "developer",
                    m,
                    True,
                    False,
                )

            # Step 10: Emit to generate_artifact handler with grading tools
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "attempt",
                    "resource_type": "grade",
                    "modality": "call",
                    "run_id": str(run_id),
                    "group_id": str(group_id) if group_id else None,
                    "attempt_id": str(data.attempt_id),
                    "chat_id": str(data.chat_id) if data.chat_id else None,
                    "grade_id": str(grade_id) if grade_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider_name,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                        "tool_choice": "required",
                    },
                    "tools": convert_tools_to_dict(tools),
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

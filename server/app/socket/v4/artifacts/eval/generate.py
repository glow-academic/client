"""Eval generation handler - domain-based generation using get_eval_websocket.

Follows the persona gold standard pattern:
1. Validates domain_ids from client
2. Uses get_eval_websocket() to get domain-to-agent mapping
3. Derives resource_types from domain_ids
4. Routes through unified generation pipeline
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.eval.get import get_eval_websocket
from app.api.v4.artifacts.eval.types import (
    EvalResourceBucket,
    GetEvalWebsocketResponse,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.eval.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.eval.types import GenerateEvalPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaGenerationContextSqlParams,
    GetPersonaGenerationContextSqlRow,
    PreparePersonaGenerationSqlParams,
    PreparePersonaGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths (reuse persona generation infrastructure)
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/persona/get_persona_generation_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

# Eval resource types
EVAL_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "agents",
    "rubrics",
]


def _build_eval_jinja_context(
    response: GetEvalWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from eval websocket response."""
    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else EvalResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": EvalResourceBucket().model_dump()}


async def _eval_generate_impl(
    sid: str, data: GenerateEvalPayload, profile_id: uuid.UUID
) -> None:
    """Handle eval generation with domain-based architecture."""
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="eval",
                    group_id=None,
                    resource_type="eval",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch eval data for domain-to-agent mapping
        result = await get_eval_websocket(
            profile_id=profile_id,
            eval_id=data.eval_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.agents_domain_id: "agents",
            result.rubrics_domain_id: "rubrics",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid domain_ids provided",
                    artifact_type="eval",
                    group_id=None,
                    resource_type="eval",
                ),
                sid=sid,
            )
            return

        invalid_types = [rt for rt in resource_types if rt not in EVAL_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="eval",
                    group_id=None,
                    resource_type="eval",
                ),
                sid=sid,
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested domains",
                    artifact_type="eval",
                    group_id=None,
                    resource_type="eval",
                ),
                sid=sid,
            )
            return

        eval_jinja_context = _build_eval_jinja_context(result, resource_types)
        existing_group_id: uuid.UUID | None = result.group_id

        # Step 2: Fetch context and validate prerequisites
        async with get_db_connection() as conn:
            context_params = GetPersonaGenerationContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
            )
            context_row = cast(
                GetPersonaGenerationContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            # Build context dataclass for validation
            ctx = GenerationContext(
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
            )

            # Validate using business logic in Python
            is_valid, failures = validate_generation_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Eval generation validation failed - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare eval generation: {error_msg}",
                        artifact_type="eval",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="eval",
                    ),
                    sid=sid,
                )
                return

            # Step 3: Prepare generation (group/run creation, context fetch)
            prepare_params = PreparePersonaGenerationSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
                p_group_id=existing_group_id,
                p_resources=None,  # Eval doesn't use resource tree
                p_current_resources=None,
                p_resource_types=resource_types,
            )
            prepare_row = cast(
                PreparePersonaGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row.run_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare eval generation: Unknown error",
                        artifact_type="eval",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="eval",
                    ),
                    sid=sid,
                )
                return

            # Extract context from prepare result
            run_id = prepare_row.run_id
            group_id = prepare_row.group_id
            trace_id = prepare_row.trace_id
            system_prompt = prepare_row.system_prompt
            model_name = prepare_row.model_name
            provider_name = prepare_row.provider_name
            base_url = prepare_row.base_url
            api_key = prepare_row.api_key
            temperature = prepare_row.temperature
            reasoning = prepare_row.reasoning
            voice = prepare_row.voice
            quality = prepare_row.quality
            tools = prepare_row.tools
            developer_instruction_templates = (
                prepare_row.developer_instruction_templates
            )

            # Step 4: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=eval_jinja_context,
            )

            # Step 5: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

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

            if data.user_instructions:
                for instruction in data.user_instructions:
                    messages.append({"role": "user", "content": instruction})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "user",
                        instruction,
                        True,
                        False,
                    )

            # Step 6: Emit to generate_artifact handler
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "eval",
                    "resource_type": resource_types[0] if resource_types else "eval",
                    "run_id": str(run_id),
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider_name,
                        "voice": voice,
                        "quality": quality,
                        "length_seconds": None,
                        "tool_choice": "required",
                    },
                    "tools": convert_tools_to_dict(tools),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate eval resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate eval resources: {str(e)}",
                artifact_type="eval",
                group_id=None,
                resource_type="eval",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def eval_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle eval_generate client event."""
    try:
        payload = GenerateEvalPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="eval",
                    group_id=None,
                    resource_type="eval",
                ),
                sid=sid,
            )
            return

        await _eval_generate_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="eval",
                group_id=None,
                resource_type="eval",
            ),
            sid=sid,
        )

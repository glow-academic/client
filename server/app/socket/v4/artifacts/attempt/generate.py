"""Attempt generation router - unified handler for all attempt entry types.

This module handles all business logic for attempt generation:
- Rate limit validation (fail fast) — skipped when handler already validated
- Group/run creation — skipped when handler already created via prepare SQL
- Agent/model context from pre-fetched resources (denormalized chain)
- Jinja template rendering for developer instructions
- Chat history from views (attempt_message)
- Message insertion with deduplication

Callers (message.py, grade.py, audio/start.py) handle domain-specific mutations,
then delegate to attempt_generate via internal bus with pre-created run_id/group_id.
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
from app.infra.v4.websocket.generation_tracker import (
    init_generation,
    init_resource_progress,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.attempt.types import (
    ATTEMPT_ENTRY_TYPES,
    ATTEMPT_GRADE_ENTRY_TYPES,
    AttemptGenerationStartedEvent,
    GenerateAttemptPayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetAgentEntryToolsSqlParams,
    GetAgentEntryToolsSqlRow,
    PreparePersonaGenerationSqlParams,
    PreparePersonaGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql"
)
SQL_PATH_AGENT_ENTRY_TOOLS = (
    "app/sql/v4/queries/generate/attempt/get_agent_entry_tools_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


def _build_attempt_jinja_context(
    response: GetAttemptWebsocketResponse, entry_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context with resources as top-level variables.

    Resources are the current selections (from get_attempt_internal's ID resolution).
    Templates access resources directly: {{ rubrics }}, {{ agents[0].temperature }}
    Views (e.g. attempt_message) are injected separately.
    """
    if response.resources:
        return response.resources.model_dump(mode="json")
    return {}


async def _attempt_generate_impl(
    sid: str,
    data: GenerateAttemptPayload,
    profile_id: uuid.UUID,
    extra: dict[str, Any] | None = None,
) -> None:
    """Handle attempt generation with all business logic.

    When called directly (client → attempt_generate), runs full pipeline.
    When called from handlers (message/grade/audio via internal bus),
    extra dict carries pre-created run_id/group_id — skips rate limit + prepare.
    """
    try:
        # Validate entry_types
        if not data.entry_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="entry_types must be provided",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        entry_types = data.entry_types

        invalid_types = [et for et in entry_types if et not in ATTEMPT_ENTRY_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid entry types: {', '.join(invalid_types)}",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Extract pre-created IDs from handler (passed via internal bus)
        pre_run_id: uuid.UUID | None = None
        pre_group_id: uuid.UUID | None = None
        extra_chat_id: uuid.UUID | None = None
        extra_grade_id: uuid.UUID | None = None
        if extra:
            if extra.get("run_id"):
                pre_run_id = uuid.UUID(str(extra["run_id"]))
            if extra.get("group_id"):
                pre_group_id = uuid.UUID(str(extra["group_id"]))
            if extra.get("chat_id"):
                extra_chat_id = uuid.UUID(str(extra["chat_id"]))
            if extra.get("grade_id"):
                extra_grade_id = uuid.UUID(str(extra["grade_id"]))

        # Detect modality and resource_type from entry_types
        is_grade = any(et in ATTEMPT_GRADE_ENTRY_TYPES for et in entry_types)
        resource_type = "grade" if is_grade else "attempt"
        modality = "call" if is_grade else "text"

        # Step 1: Fetch attempt data (includes pre-fetched config resources)
        async with get_db_connection() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=data.attempt_id,
            )

        # Resolve agent_id from resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for _key, aid in resource_agent_ids.items():
            if aid is not None:
                agent_id = aid
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested entry types",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 2: Extract LLM config from pre-fetched resources
        config_agents = result.resources.agents or [] if result.resources else []
        config_models = result.resources.models or [] if result.resources else []
        config_providers = result.resources.providers or [] if result.resources else []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        # Validate: agent resource must exist
        if not agent_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configuration found. Check department settings.",
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
        voice = agent_resource.voice if hasattr(agent_resource, "voice") else None
        quality = agent_resource.quality if hasattr(agent_resource, "quality") else None
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

        attempt_jinja_context = _build_attempt_jinja_context(result, entry_types)

        # Step 3: Check rate limit — skip when handler already validated
        if not pre_run_id:
            config_profile = (
                result.resources.config_profile[0]
                if result.resources and result.resources.config_profile
                else None
            )
            requests_per_day = (
                config_profile.requests_per_day if config_profile else None
            )
            runs_today = (
                result.views.runs.total_count
                if result.views and result.views.runs
                else 0
            )

            if requests_per_day is not None and runs_today >= requests_per_day:
                error_msg = f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
                logger.error(
                    f"Attempt generation rate limit exceeded - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare attempt generation: {error_msg}",
                        artifact_type="attempt",
                        group_id=str(result.group_id) if result.group_id else None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        existing_group_id = pre_group_id or result.group_id

        async with get_db_connection() as conn:
            # Fetch tools, prompts, and instructions in parallel
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            async def fetch_tools():
                async with pool.acquire() as c:
                    tools_params = GetAgentEntryToolsSqlParams(
                        p_agent_id=agent_id,
                        p_entry_types=entry_types,
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

            # Prepare generation — skip when handler already created run/config
            if pre_run_id:
                run_id = pre_run_id
                group_id = existing_group_id
            else:
                prepare_params = PreparePersonaGenerationSqlParams(
                    p_profile_id=profile_id,
                    p_group_id=existing_group_id,
                    p_agents_resource_id=agent_resource.id,
                    p_models_resource_id=model_resource.id,
                    p_providers_resource_id=provider_resource.id,
                )
                prepare_row = cast(
                    PreparePersonaGenerationSqlRow,
                    await execute_sql_typed(
                        conn, SQL_PATH_PREPARE, params=prepare_params
                    ),
                )

                if not prepare_row.run_id:
                    logger.error(
                        f"Attempt generation preparation failed unexpectedly - "
                        f"profile_id={profile_id}, agent_id={agent_id}"
                    )
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to prepare attempt generation: Unknown error",
                            artifact_type="attempt",
                            group_id=str(existing_group_id)
                            if existing_group_id
                            else None,
                            resource_type="attempt",
                        ),
                        sid=sid,
                    )
                    return

                run_id = prepare_row.run_id
                group_id = prepare_row.group_id

            jinja_context = attempt_jinja_context

            # Inject views into Jinja context for template access
            if result.views:
                views_dict: dict[str, Any] = {}
                if result.views.attempt:
                    views_dict["attempt"] = [
                        a.model_dump(mode="json")
                        for a in result.views.attempt
                    ]
                if result.views.attempt_chat:
                    views_dict["attempt_chat"] = [
                        c.model_dump(mode="json") for c in result.views.attempt_chat
                    ]
                if result.views.attempt_message:
                    views_dict["attempt_message"] = [
                        m.model_dump(mode="json")
                        for m in result.views.attempt_message
                    ]
                jinja_context["views"] = views_dict

            # Inject grade data if present (from handler's prepare SQL)
            if extra_grade_id:
                jinja_context["grade"] = {"id": str(extra_grade_id)}

            # Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Build messages for LLM AND persist to database
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

            # Build chat history from views (for message handlers)
            # Resolve chat_id: from extra context, or first active chat in views
            chat_id_for_history = extra_chat_id
            if (
                not chat_id_for_history
                and result.views
                and result.views.attempt_chat
            ):
                chat_id_for_history = result.views.attempt_chat[0].id

            if (
                chat_id_for_history
                and result.views
                and result.views.attempt_message
            ):
                for msg in result.views.attempt_message:
                    if msg.chat_id == chat_id_for_history and msg.completed:
                        role = "user" if msg.type == "query" else "assistant"
                        content = ""
                        if msg.contents:
                            content = msg.contents[0].content or ""
                        messages.append({"role": role, "content": content})

            # Insert user instructions
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

            # Initialize generation tracker
            await init_generation(str(run_id), 1)
            await init_resource_progress(str(run_id), len(entry_types))

            # Emit attempt_generation_started to client
            await sio.emit(
                "attempt_generation_started",
                {
                    "artifact_type": "attempt",
                    "group_id": str(group_id) if group_id else "",
                    "run_id": str(run_id),
                    "entry_types": entry_types,
                },
                room=sid,
            )

            # Convert tools and attach _args_outputs for output schema resolution
            tool_dicts = convert_tools_to_dict(tools)
            if tool_dicts and result.resources:
                resource_tools = result.resources.tools or []
                tool_output_ids_by_name: dict[str, list] = {}
                for rt in resource_tools:
                    if rt.name and rt.args_output_ids:
                        tool_output_ids_by_name[rt.name] = rt.args_output_ids

                config_ao = result.resources.config_args_outputs or []
                ao_by_id = {ao.id: ao for ao in config_ao if ao.id}

                for td in tool_dicts:
                    t_name = td.get("name")
                    if t_name and t_name in tool_output_ids_by_name:
                        ao_list = []
                        for ao_id in tool_output_ids_by_name[t_name]:
                            ao = ao_by_id.get(ao_id)
                            if ao:
                                ao_list.append(
                                    {"name": ao.name, "template": ao.template}
                                )
                        if ao_list:
                            td["_args_outputs"] = ao_list

            # Dispatch to generate_artifact handler
            artifact_payload: dict[str, Any] = {
                "sid": sid,
                "artifact_type": "attempt",
                "resource_type": resource_type,
                "modality": modality,
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
                "tools": tool_dicts,
            }

            # Pass through domain-specific IDs for complete handler
            if extra_grade_id:
                artifact_payload["grade_id"] = str(extra_grade_id)
            if extra_chat_id:
                artifact_payload["chat_id"] = str(extra_chat_id)
            artifact_payload["attempt_id"] = str(data.attempt_id)

            await internal_sio.emit("generate_artifact", artifact_payload)

    except Exception as e:
        logger.exception(f"Failed to generate attempt resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate attempt resources: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def attempt_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_generate event (client-to-server)."""
    try:
        payload = GenerateAttemptPayload(**data)
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
        await _attempt_generate_impl(sid, payload, profile_id)
    except Exception as e:
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


@internal_sio.on("attempt_generate")  # type: ignore
async def attempt_generate_internal(data: dict[str, Any]) -> None:
    """Handle attempt_generate event from internal bus (server-to-server).

    Handlers (message.py, grade.py, audio/start.py) pass pre-created
    run_id/group_id/chat_id/grade_id as extra dict keys alongside the
    standard GenerateAttemptPayload fields.
    """
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
        payload = GenerateAttemptPayload(**data)
        await _attempt_generate_impl(sid, payload, profile_id, extra=data)
    except Exception as e:
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
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/generate")
async def attempt_generate_api(
    request: GenerateAttemptPayload,
) -> dict[str, bool]:
    """Client-to-server event: attempt_generate.

    Unified generation handler that accepts entry_types to filter tools.
    """
    return {"success": True}


@server_router.post("/attempt/generation_started")
async def attempt_generation_started_api(
    request: AttemptGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt generation started.

    Emitted when attempt generation begins, listing entry types being generated.
    """
    return {"success": True}

"""Provider generation router - unified handler for provider resource types.

This module handles all business logic for provider generation:
- Rate limit validation (fail fast)
- Group/run creation
- Agent/model context from pre-fetched resources (denormalized chain)
- Jinja template rendering for developer instructions
- Message insertion with deduplication
- Multi-agent dispatch via generation tracker

The AI handler (generate.py) receives a simplified payload with pre-rendered content.
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.provider.get import get_provider_websocket
from app.api.v4.artifacts.provider.types import GetProviderWebsocketResponse
from app.api.v4.entries.config.get import get_config_entry_internal
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
from app.socket.v4.artifacts.provider.types import (
    PROVIDER_RESOURCE_TYPES,
    GenerateProviderPayload,
)
from app.socket.v4.artifacts.types import (
    GenerateErrorApiRequest,
    ProviderGenerationStartedEvent,
)
from app.sql.types import (
    GetAgentToolsSqlParams,
    GetAgentToolsSqlRow,
    PrepareProviderGenerationSqlParams,
    PrepareProviderGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/provider/prepare_provider_generation_complete.sql"
)
SQL_PATH_AGENT_TOOLS = (
    "app/sql/v4/queries/generate/persona/get_agent_tools_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


def _build_provider_jinja_context(
    response: GetProviderWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    _ = resource_types
    if response.resources:
        return response.resources.model_dump()
    return {}


async def _provider_generate_impl(
    sid: str, data: GenerateProviderPayload, profile_id: uuid.UUID
) -> None:
    try:
        # Validate resource_types
        if not data.resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return
        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for provider generation",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        resource_types = data.resource_types
        if "keys" in resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Key generation is disabled for providers",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            resource_type
            for resource_type in resource_types
            if resource_type not in PROVIDER_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch pre-hydrated provider data
        result = await get_provider_websocket(
            profile_id=profile_id,
            provider_id=data.provider_id,
            draft_id=data.draft_id,
        )
        resource_agent_ids = result.resource_agent_ids or {}

        # Step 2: Build agent_groups: {agent_id: [resource_types]}
        agent_groups: dict[uuid.UUID, list[str]] = {}
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_groups.setdefault(aid, []).append(rt)

        # Fallback: if no agent found for any resource type, pick first available
        if not agent_groups:
            for _rt, aid in resource_agent_ids.items():
                if aid is not None:
                    agent_groups[aid] = resource_types
                    break

        # Use first agent_id for validation (all share same config chain)
        agent_id: uuid.UUID | None = next(iter(agent_groups)) if agent_groups else None

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested resource types",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        # Step 3: Extract LLM config from pre-fetched resources
        config_agents = result.resources.config_agents or []
        config_models = result.resources.config_models or []
        config_providers = result.resources.config_providers or []
        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource or not model_resource or not provider_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Incomplete provider generation configuration",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

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

        if not api_key:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"No API key configured for provider '{provider_name}'",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        # Step 4: Rate limit check (fail fast)
        config_profile = (
            result.resources.config_profile[0]
            if result.resources.config_profile
            else None
        )
        requests_per_day = config_profile.requests_per_day if config_profile else None
        runs_today = (
            result.views.runs.total_count if result.views and result.views.runs else 0
        )
        if requests_per_day is not None and runs_today >= requests_per_day:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)",
                    artifact_type="provider",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return

        provider_jinja_context = _build_provider_jinja_context(result, resource_types)
        existing_group_id = result.group_id

        # Step 5: Parallel fetch tools/prompts/instructions + prepare generation
        async with get_db_connection() as conn:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            async def fetch_tools():
                async with pool.acquire() as c:
                    tools_params = GetAgentToolsSqlParams(
                        p_agent_id=agent_id,
                        p_resource_types=resource_types,
                    )
                    tools_row = cast(
                        GetAgentToolsSqlRow,
                        await execute_sql_typed(
                            c, SQL_PATH_AGENT_TOOLS, params=tools_params
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

            # Step 6: Prepare generation (create group/run/config)
            prepare_params = PrepareProviderGenerationSqlParams(
                p_profile_id=profile_id,
                p_group_id=existing_group_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )
            prepare_row = cast(
                PrepareProviderGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )
            if not prepare_row.run_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare provider generation",
                        artifact_type="provider",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="provider",
                    ),
                    sid=sid,
                )
                return

            run_id = prepare_row.run_id
            group_id = prepare_row.group_id
            trace_id = prepare_row.trace_id
            config_id = prepare_row.config_id
            _ = trace_id  # Available for future tracing

            # Step 7: Config view injection into Jinja context
            jinja_context = provider_jinja_context
            if config_id:
                async with pool.acquire() as config_conn:
                    config_view_items = await get_config_entry_internal(
                        conn=config_conn,
                        config_id=config_id,
                        bypass_cache=True,
                    )
                    config_view = (
                        config_view_items[0].model_dump(mode="json")
                        if config_view_items
                        else {}
                    )
            else:
                config_view = {}

            draft_view = {}
            if result.views and result.views.draft_provider:
                draft_view = result.views.draft_provider.model_dump(mode="json")
            jinja_context["views"] = {
                "config": config_view,
                "draft_provider": draft_view,
            }

            # Step 8: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 9: Insert pre-rendered messages
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                await conn.fetchval(
                    create_message_sql, run_id, "system", system_prompt, True, False
                )
            for m in rendered_developer_messages:
                messages.append({"role": "developer", "content": m})
                await conn.fetchval(
                    create_message_sql, run_id, "developer", m, True, False
                )
            if data.user_instructions:
                for instruction in data.user_instructions:
                    messages.append({"role": "user", "content": instruction})
                    await conn.fetchval(
                        create_message_sql, run_id, "user", instruction, True, False
                    )

            # Step 10: Initialize generation tracker for multi-agent support
            num_agents = len(agent_groups)
            await init_generation(str(run_id), num_agents)
            await init_resource_progress(str(run_id), len(resource_types))

            # Emit provider_generation_started to client
            await sio.emit(
                "provider_generation_started",
                ProviderGenerationStartedEvent(
                    artifact_type="provider",
                    group_id=str(group_id) if group_id else "",
                    run_id=str(run_id),
                    resource_types=resource_types,
                ).model_dump(mode="json"),
                room=sid,
            )

            # Step 11: Dispatch to generate_artifact handler(s)
            for _agent_group_id, agent_resource_types in agent_groups.items():
                await internal_sio.emit(
                    "generate_artifact",
                    {
                        "sid": sid,
                        "artifact_type": "provider",
                        "resource_type": agent_resource_types[0]
                        if agent_resource_types
                        else "provider",
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
                        "save": data.save,
                    },
                )

    except Exception as e:
        logger.exception(f"Failed to generate provider resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate provider resources: {str(e)}",
                artifact_type="provider",
                group_id=None,
                resource_type="provider",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def provider_generate(sid: str, data: dict[str, Any]) -> None:
    try:
        payload = GenerateProviderPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return
        await _provider_generate_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="provider",
                group_id=None,
                resource_type="provider",
            ),
            sid=sid,
        )


@internal_sio.on("provider_generate")  # type: ignore
async def provider_generate_internal(data: dict[str, Any]) -> None:
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
                    artifact_type="provider",
                    group_id=None,
                    resource_type="provider",
                ),
                sid=sid,
            )
            return
        payload = GenerateProviderPayload(**data)
        await _provider_generate_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="provider",
                group_id=None,
                resource_type="provider",
            ),
            sid=sid,
        )


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/provider_generation_started")
async def provider_generation_started_api(
    request: ProviderGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Provider generation started.

    Emitted when provider generation begins, listing resource types being generated.
    """
    return {"success": True}

"""Agent get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_agent_internal() - Core data fetching (cacheable, returns dataclass)
2. get_agent_websocket() - Minimal data for WebSocket handlers
3. get_agent_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.agent.permissions import (
    AGENT_BASIC_RESOURCES,
    AGENT_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_instructions_required,
    compute_models_required,
    compute_name_required,
    compute_prompts_required,
    compute_reasoning_levels_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_instructions,
    compute_show_models,
    compute_show_name,
    compute_show_prompts,
    compute_show_reasoning_levels,
    compute_show_temperature_levels,
    compute_show_tools,
    compute_show_voices,
    compute_temperature_levels_required,
    compute_tools_required,
    compute_voices_required,
    get_missing_tools,
    has_access,
)
from app.api.v4.artifacts.agent.types import (
    AgentDepartmentSection,
    AgentDescriptionSection,
    AgentFlagConfig,
    AgentFlagSection,
    AgentInstructionSection,
    AgentModelSection,
    AgentNameSection,
    AgentPromptSection,
    AgentReasoningLevelSection,
    AgentResourceBucket,
    AgentResources,
    AgentTemperatureLevelSection,
    AgentToolSection,
    AgentVoiceSection,
    AgentWebsocketResources,
    AgentWebsocketViews,
    GetAgentApiRequest,
    GetAgentApiResponse,
    GetAgentWebsocketResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.instructions.search import search_instructions_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.models.search import search_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.api.v4.resources.prompts.search import search_prompts_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.reasoning_levels.search import (
    search_reasoning_levels_internal,
)
from app.api.v4.resources.temperature_levels.get import (
    get_temperature_levels_internal,
)
from app.api.v4.resources.temperature_levels.search import (
    search_temperature_levels_internal,
)
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.tools.search import search_tools_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.api.v4.resources.voices.search import search_voices_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_agent_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAgentAccessSqlParams,
    GetAgentAccessSqlRow,
    GetAgentIdsSqlParams,
    GetAgentIdsSqlRow,
    QGetAgentsV4Item,
    QGetProvidersV4Item,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/agents/get_agent_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/agents/get_agent_ids_complete.sql"

# Agent-specific flag names
AGENT_FLAG_NAMES = {"agent_active"}

router = APIRouter()


@dataclass
class AgentInternalData:
    """Internal data from core agent fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_agent_websocket() - minimal data for WebSocket handlers
    - get_agent_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    agent_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent routing map (resource_type -> selected agent_id)
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: selected agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    general_show_ai_generate: bool

    # Resources payload
    resources_payload: AgentResources

    # Draft view for websocket/jinja context
    draft_view: Any | None

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Config resources for websocket generation context
    config_agents: list[QGetAgentsV4Item]
    config_providers: list[QGetProvidersV4Item]


async def get_agent_internal(
    profile_id: UUID,
    agent_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> AgentInternalData:
    """Core data fetching layer (cacheable).

    Fetches all agent data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path).
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    # Extract user context from internal fetch (single source of truth)
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_agent_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetAgentAccessSqlParams(
            profile_id=profile_id,
            agent_id=agent_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetAgentAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        agent_department_ids = access_result.agent_department_ids or []

        # Early validation: check agent exists
        if agent_id is not None:
            if access_result.agent_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agent {agent_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, agent_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this agent. It may be restricted to other departments.",
                )

        effective_group_id = access_result.group_id
        effective_draft_version = (
            draft_item.version
            if draft_item is not None
            else access_result.draft_version
        )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetAgentIdsSqlParams(
            profile_id=profile_id,
            agent_id=agent_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetAgentIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # Extract resource IDs from Query 2
    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_model_id = ids_result.model_id
    selected_prompt_id = ids_result.prompt_id
    selected_instructions_id = ids_result.instructions_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_temperature_level_id = ids_result.temperature_level_id
    selected_reasoning_level_id = ids_result.reasoning_level_id

    selected_department_ids = ids_result.department_ids or []
    selected_tool_ids = ids_result.tool_ids or []
    selected_voice_ids = ids_result.voice_ids or []

    # Draft values override canonical agent-junction values
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.model_ids:
            selected_model_id = draft_item.model_ids[0]
        if draft_item.prompt_ids:
            selected_prompt_id = draft_item.prompt_ids[0]
        if draft_item.instruction_ids:
            selected_instructions_id = draft_item.instruction_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.tool_ids:
            selected_tool_ids = draft_item.tool_ids
        if draft_item.temperature_level_ids:
            selected_temperature_level_id = draft_item.temperature_level_ids[0]
        if draft_item.reasoning_level_ids:
            selected_reasoning_level_id = draft_item.reasoning_level_ids[0]
        if draft_item.voice_ids:
            selected_voice_ids = draft_item.voice_ids

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    descriptions_has_tools = ids_result.descriptions_has_tools or False
    models_has_tools = ids_result.models_has_tools or False
    prompts_has_tools = ids_result.prompts_has_tools or False
    instructions_has_tools = ids_result.instructions_has_tools or False
    departments_has_tools = ids_result.departments_has_tools or False
    tools_has_tools = ids_result.tools_has_tools or False
    temperature_levels_has_tools = ids_result.temperature_levels_has_tools or False
    reasoning_levels_has_tools = ids_result.reasoning_levels_has_tools or False
    voices_has_tools = ids_result.voices_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(AGENT_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=AGENT_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in AGENT_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        agent_id_for_resource = agent_ids.get(resource)
        return agent_id_for_resource is not None

    show_ai_generate_map = {
        resource: compute_show_ai_generate(resource) for resource in AGENT_RESOURCES
    }

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in AGENT_BASIC_RESOURCES
    )
    general_show_ai_generate = any(show_ai_generate_map.values())

    # === PYTHON BUSINESS LOGIC ===
    missing_tools = get_missing_tools(
        names_has_tools=names_has_tools,
        models_has_tools=models_has_tools,
        prompts_has_tools=prompts_has_tools,
        instructions_has_tools=instructions_has_tools,
    )

    has_agent_access = has_access(user_role, user_department_ids, agent_department_ids)

    can_edit = compute_can_edit(
        user_role=user_role,
        has_agent_access=has_agent_access,
        missing_tools=missing_tools,
        agent_id=agent_id,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        has_agent_access=has_agent_access,
        missing_tools=missing_tools,
        agent_id=agent_id,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    model_ids = [selected_model_id] if selected_model_id else []
    prompt_ids = [selected_prompt_id] if selected_prompt_id else []
    instructions_ids = [selected_instructions_id] if selected_instructions_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids_list = selected_department_ids
    tool_ids_list = selected_tool_ids
    temperature_level_ids = (
        [selected_temperature_level_id] if selected_temperature_level_id else []
    )
    reasoning_level_ids = (
        [selected_reasoning_level_id] if selected_reasoning_level_id else []
    )
    voice_ids_list = selected_voice_ids

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, bypass_cache)
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                None,
                None,
                description_ids,
                bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_models():
        async with pool.acquire() as c:
            selected = await get_models_internal(c, model_ids, bypass_cache)
            suggestions = await search_models_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=model_ids,
                bypass_cache=bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_prompts():
        async with pool.acquire() as c:
            selected = await get_prompts_internal(c, prompt_ids, bypass_cache)
            suggestions = await search_prompts_internal(
                c,
                None,
                20,
                0,
                prompt_ids,
                bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_instructions():
        async with pool.acquire() as c:
            selected = await get_instructions_internal(
                c, instructions_ids, bypass_cache
            )
            suggestions = await search_instructions_internal(
                c,
                None,
                20,
                0,
                None,
                None,
                instructions_ids,
                bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c, None, 50, 0, flag_ids, bypass_cache, agent=True
            )
            # Filter to only agent-specific flags
            suggestions = [f for f in all_flags if f.name in AGENT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(
                c, department_ids_list, bypass_cache
            )
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids_list,
                bypass_cache=bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_tools():
        async with pool.acquire() as c:
            selected = await get_tools_internal(c, tool_ids_list, bypass_cache)
            suggestions = await search_tools_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=tool_ids_list,
                bypass_cache=bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    async def fetch_temperature_levels():
        async with pool.acquire() as c:
            selected = await get_temperature_levels_internal(
                c, temperature_level_ids, bypass_cache
            )
            suggestions = await search_temperature_levels_internal(
                c, None, 20, 0, temperature_level_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_reasoning_levels():
        async with pool.acquire() as c:
            selected = await get_reasoning_levels_internal(
                c, reasoning_level_ids, bypass_cache
            )
            suggestions = await search_reasoning_levels_internal(
                c, None, 20, 0, reasoning_level_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_voices():
        async with pool.acquire() as c:
            selected = await get_voices_internal(c, voice_ids_list, bypass_cache)
            suggestions = await search_voices_internal(
                c,
                None,
                20,
                0,
                voice_ids_list,
                bypass_cache,
                agent=True,
            )
            return (selected, suggestions)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (models_selected, models_suggestions),
        (prompts_selected, prompts_suggestions),
        (instructions_selected, instructions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (tools_selected, tools_suggestions),
        (temperature_levels_selected, temperature_levels_suggestions),
        (reasoning_levels_selected, reasoning_levels_suggestions),
        (voices_selected, voices_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_models(),
        fetch_prompts(),
        fetch_instructions(),
        fetch_flags(),
        fetch_departments(),
        fetch_tools(),
        fetch_temperature_levels(),
        fetch_reasoning_levels(),
        fetch_voices(),
    )

    # Dedupe: selected + suggestions, preserving order
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    models = _dedupe_by_id(models_selected + models_suggestions, "id")
    prompts = _dedupe_by_id(prompts_selected + prompts_suggestions, "id")
    instructions = _dedupe_by_id(instructions_selected + instructions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    tools = _dedupe_by_id(tools_selected + tools_suggestions, "id")
    temperature_levels = _dedupe_by_id(
        temperature_levels_selected + temperature_levels_suggestions, "id"
    )
    reasoning_levels = _dedupe_by_id(
        reasoning_levels_selected + reasoning_levels_suggestions, "id"
    )
    voices = _dedupe_by_id(voices_selected + voices_suggestions, "id")

    # Compute show flags
    show_name = compute_show_name(names_has_tools)
    show_description = compute_show_description(descriptions_has_tools)
    show_models_flag = compute_show_models(models_has_tools)
    show_prompts_flag = compute_show_prompts(prompts_has_tools)
    show_instructions_flag = compute_show_instructions(instructions_has_tools)
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(
        departments_has_tools, len(departments) > 0
    )
    show_tools_flag = compute_show_tools(tools_has_tools, len(tools) > 0)
    show_temperature_levels_flag = compute_show_temperature_levels(
        temperature_levels_has_tools
    )
    show_reasoning_levels_flag = compute_show_reasoning_levels(
        reasoning_levels_has_tools
    )
    show_voices_flag = compute_show_voices(voices_has_tools)

    # Build show and required flags maps
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description,
        "models": show_models_flag,
        "prompts": show_prompts_flag,
        "instructions": show_instructions_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "tools": show_tools_flag,
        "temperature_levels": show_temperature_levels_flag,
        "reasoning_levels": show_reasoning_levels_flag,
        "voices": show_voices_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "models": compute_models_required(),
        "prompts": compute_prompts_required(),
        "instructions": compute_instructions_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "tools": compute_tools_required(),
        "temperature_levels": compute_temperature_levels_required(),
        "reasoning_levels": compute_reasoning_levels_required(),
        "voices": compute_voices_required(),
    }

    # Transform flags to enriched format for client
    agent_flags = [
        AgentFlagConfig(
            key=_derive_flag_key_and_label(flag.name)[0],
            label=_derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    # Build suggestion ID lists
    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in names_suggestions],
        "descriptions": [d.id for d in descriptions_suggestions],
        "models": [m.id for m in models_suggestions],
        "prompts": [p.id for p in prompts_suggestions],
        "instructions": [i.id for i in instructions_suggestions],
        "departments": [d.department_id for d in departments_suggestions],
        "tools": [t.id for t in tools_suggestions],
        "temperature_levels": [t.id for t in temperature_levels_suggestions],
        "reasoning_levels": [r.id for r in reasoning_levels_suggestions],
        "voices": [v.id for v in voices_suggestions],
    }

    # === Construct Resources Payload ===
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    model_resource = next((m for m in models if m.id == selected_model_id), None)
    prompt_resource = next((p for p in prompts if p.id == selected_prompt_id), None)
    instructions_resource = next(
        (i for i in instructions if i.id == selected_instructions_id), None
    )
    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    tool_resources = [t for t in tools if t.id in set(selected_tool_ids)]
    temperature_level_resource = next(
        (t for t in temperature_levels if t.id == selected_temperature_level_id), None
    )
    reasoning_level_resource = next(
        (r for r in reasoning_levels if r.id == selected_reasoning_level_id), None
    )
    voice_resources = [v for v in voices if v.id in set(selected_voice_ids)]

    resources_payload = AgentResources(
        resources=AgentResourceBucket(
            names=names,
            descriptions=descriptions,
            models=models,
            prompts=prompts,
            instructions=instructions,
            flags=agent_flags,
            departments=departments,
            tools=tools,
            temperature_levels=temperature_levels,
            reasoning_levels=reasoning_levels,
            voices=voices,
        ),
        current=AgentResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            models=[model_resource] if model_resource else [],
            prompts=[prompt_resource] if prompt_resource else [],
            instructions=[instructions_resource] if instructions_resource else [],
            flags=[
                f for f in agent_flags if f.flag_option_id == selected_active_flag_id
            ]
            if selected_active_flag_id
            else [],
            departments=department_resources or [],
            tools=tool_resources or [],
            temperature_levels=(
                [temperature_level_resource] if temperature_level_resource else []
            ),
            reasoning_levels=(
                [reasoning_level_resource] if reasoning_level_resource else []
            ),
            voices=voice_resources or [],
        ),
    )

    selected_agent_ids = list({aid for aid in agent_ids.values() if aid is not None})
    config_agents: list[QGetAgentsV4Item] = []
    if selected_agent_ids:
        async with pool.acquire() as c:
            config_agents = await get_agents_internal(
                c, selected_agent_ids, bypass_cache
            )
    provider_ids = list({m.provider_id for m in models if m.provider_id is not None})
    config_providers: list[QGetProvidersV4Item] = []
    if provider_ids:
        async with pool.acquire() as c:
            config_providers = await get_providers_internal(
                c, provider_ids, bypass_cache
            )

    return AgentInternalData(
        # Access/context
        actor_name=actor_name,
        agent_exists=access_result.agent_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        general_show_ai_generate=general_show_ai_generate,
        # Resources and draft view
        resources_payload=resources_payload,
        draft_view=draft_item,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        # Config resources
        config_agents=config_agents,
        config_providers=config_providers,
    )


async def get_agent_websocket(
    profile_id: UUID,
    agent_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAgentWebsocketResponse:
    """WebSocket generation response with selected resources and routing map."""
    data = await get_agent_internal(
        profile_id=profile_id,
        agent_id=agent_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    current = data.resources_payload.current
    websocket_resources = AgentWebsocketResources(
        names=current.names if current else [],
        descriptions=current.descriptions if current else [],
        models=current.models if current else [],
        prompts=current.prompts if current else [],
        instructions=current.instructions if current else [],
        flags=current.flags if current else [],
        departments=current.departments if current else [],
        tools=current.tools if current else [],
        temperature_levels=current.temperature_levels if current else [],
        reasoning_levels=current.reasoning_levels if current else [],
        voices=current.voices if current else [],
        agents=data.config_agents,
        providers=data.config_providers,
    )

    return GetAgentWebsocketResponse(
        views=AgentWebsocketViews(draft_agent=data.draft_view),
        resources=websocket_resources,
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_agent_client(
    profile_id: UUID,
    agent_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAgentApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_agent_internal(
        profile_id=profile_id,
        agent_id=agent_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    resources = data.resources_payload.resources
    current = data.resources_payload.current
    current_flags = current.flags if current else []
    selected_flag_id = current_flags[0].flag_option_id if current_flags else None
    temperature_resource = (
        current.temperature_levels[0]
        if current and current.temperature_levels
        else None
    )
    reasoning_resource = (
        current.reasoning_levels[0] if current and current.reasoning_levels else None
    )

    return GetAgentApiResponse(
        actor_name=data.actor_name,
        agent_exists=data.agent_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        general_show_ai_generate=data.general_show_ai_generate,
        names=AgentNameSection(
            show=bool(data.show_flags_map.get("names")),
            required=bool(data.required_flags_map.get("names")),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=bool(data.show_ai_generate_map.get("names")),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=current.names[0] if current and current.names else None,
            resources=resources.names if resources else [],
        ),
        descriptions=AgentDescriptionSection(
            show=bool(data.show_flags_map.get("descriptions")),
            required=bool(data.required_flags_map.get("descriptions")),
            suggestions=data.suggestions_map.get("descriptions"),
            show_ai_generate=bool(data.show_ai_generate_map.get("descriptions")),
            create_tool_id=data.create_tool_ids_map.get("descriptions"),
            link_tool_id=data.link_tool_ids_map.get("descriptions"),
            resource=current.descriptions[0]
            if current and current.descriptions
            else None,
            resources=resources.descriptions if resources else [],
        ),
        models=AgentModelSection(
            show=bool(data.show_flags_map.get("models")),
            required=bool(data.required_flags_map.get("models")),
            suggestions=data.suggestions_map.get("models"),
            show_ai_generate=bool(data.show_ai_generate_map.get("models")),
            create_tool_id=data.create_tool_ids_map.get("models"),
            link_tool_id=data.link_tool_ids_map.get("models"),
            resource=current.models[0] if current and current.models else None,
            resources=resources.models if resources else [],
        ),
        prompts=AgentPromptSection(
            show=bool(data.show_flags_map.get("prompts")),
            required=bool(data.required_flags_map.get("prompts")),
            suggestions=data.suggestions_map.get("prompts"),
            show_ai_generate=bool(data.show_ai_generate_map.get("prompts")),
            create_tool_id=data.create_tool_ids_map.get("prompts"),
            link_tool_id=data.link_tool_ids_map.get("prompts"),
            resource=current.prompts[0] if current and current.prompts else None,
            resources=resources.prompts if resources else [],
        ),
        instructions=AgentInstructionSection(
            show=bool(data.show_flags_map.get("instructions")),
            required=bool(data.required_flags_map.get("instructions")),
            suggestions=data.suggestions_map.get("instructions"),
            show_ai_generate=bool(data.show_ai_generate_map.get("instructions")),
            create_tool_id=data.create_tool_ids_map.get("instructions"),
            link_tool_id=data.link_tool_ids_map.get("instructions"),
            resource=current.instructions[0]
            if current and current.instructions
            else None,
            resources=resources.instructions if resources else [],
        ),
        flags=AgentFlagSection(
            show=bool(data.show_flags_map.get("flags")),
            required=bool(data.required_flags_map.get("flags")),
            suggestions=None,
            show_ai_generate=bool(data.show_ai_generate_map.get("flags")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("flags"),
            current=[
                f
                for f in (resources.flags if resources else [])
                if selected_flag_id and f.flag_option_id == selected_flag_id
            ]
            if selected_flag_id
            else [],
            resources=resources.flags if resources else [],
        ),
        departments=AgentDepartmentSection(
            show=bool(data.show_flags_map.get("departments")),
            required=bool(data.required_flags_map.get("departments")),
            suggestions=data.suggestions_map.get("departments"),
            show_ai_generate=bool(data.show_ai_generate_map.get("departments")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("departments"),
            current=current.departments if current else [],
            resources=resources.departments if resources else [],
        ),
        tools=AgentToolSection(
            show=bool(data.show_flags_map.get("tools")),
            required=bool(data.required_flags_map.get("tools")),
            suggestions=data.suggestions_map.get("tools"),
            show_ai_generate=bool(data.show_ai_generate_map.get("tools")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("tools"),
            current=current.tools if current else [],
            resources=resources.tools if resources else [],
        ),
        temperature_levels=AgentTemperatureLevelSection(
            show=bool(data.show_flags_map.get("temperature_levels")),
            required=bool(data.required_flags_map.get("temperature_levels")),
            suggestions=data.suggestions_map.get("temperature_levels"),
            show_ai_generate=bool(data.show_ai_generate_map.get("temperature_levels")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("temperature_levels"),
            resource=temperature_resource,
            resources=resources.temperature_levels if resources else [],
        ),
        reasoning_levels=AgentReasoningLevelSection(
            show=bool(data.show_flags_map.get("reasoning_levels")),
            required=bool(data.required_flags_map.get("reasoning_levels")),
            suggestions=data.suggestions_map.get("reasoning_levels"),
            show_ai_generate=bool(data.show_ai_generate_map.get("reasoning_levels")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("reasoning_levels"),
            resource=reasoning_resource,
            resources=resources.reasoning_levels if resources else [],
        ),
        voices=AgentVoiceSection(
            show=bool(data.show_flags_map.get("voices")),
            required=bool(data.required_flags_map.get("voices")),
            suggestions=data.suggestions_map.get("voices"),
            show_ai_generate=bool(data.show_ai_generate_map.get("voices")),
            create_tool_id=None,
            link_tool_id=data.link_tool_ids_map.get("voices"),
            current=current.voices if current else [],
            resources=resources.voices if resources else [],
        ),
    )


def _derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'agent_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("agent_", "")
    label = key.replace("_", " ").title()
    return (key, label)


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    """Preserve order while deduplicating by id attribute."""
    seen: set[UUID] = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


@router.post(
    "/get",
    response_model=GetAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.get",
            "{{ actor.name }} {% if agent %}viewed{% else %}opened new{% endif %} agent{% if agent %} '{{ agent.name }}'{% endif %}",
        )
    ],
)
async def get_agent(
    request: GetAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentApiResponse:
    """Get agent information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_agent_client(
            profile_id=profile_id,
            agent_id=request.agent_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                response_data.names.resource.name
                if (response_data.names and response_data.names.resource)
                else None
            )
            if request.agent_id and current_name:
                audit_ctx["agent"] = {
                    "name": current_name,
                    "id": str(request.agent_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "agents"
        response.headers["X-Cache-Hit"] = "0"
        response.headers["X-Two-Pass"] = "1"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agent",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

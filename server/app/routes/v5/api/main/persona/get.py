"""Persona get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_persona_internal() - Core data fetching (cacheable, returns dataclass)
2. get_persona_websocket() - Minimal data for WebSocket handlers
3. get_persona_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from datetime import UTC
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.persona.permissions import (
    PERSONA_RESOURCES,
    compute_can_edit,
    compute_color_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_examples_required,
    compute_flag_required,
    compute_icon_required,
    compute_instructions_required,
    compute_name_required,
    compute_parameter_fields_required,
    compute_parameters_required,
    compute_show_ai_generate,
    compute_show_color,
    compute_show_departments,
    compute_show_description,
    compute_show_examples,
    compute_show_flag,
    compute_show_icon,
    compute_show_instructions,
    compute_show_name,
    compute_show_parameter_fields,
    compute_show_parameters,
    compute_show_voices,
    compute_voices_required,
    has_access,
)
from app.routes.v5.api.main.persona.types import (
    GetPersonaApiRequest,
    GetPersonaApiResponse,
    GetPersonaWebsocketResponse,
    PersonaColorSection,
    PersonaDepartmentSection,
    PersonaDescriptionSection,
    PersonaExampleSection,
    PersonaFlagConfig,
    PersonaFlagSection,
    PersonaIconSection,
    PersonaInstructionSection,
    PersonaInternalData,
    PersonaNameSection,
    PersonaParameterFieldSection,
    PersonaParameterSection,
    PersonaResourceBucket,
    PersonaResources,
    PersonaVoiceSection,
    PersonaWebsocketEntries,
    PersonaWebsocketResources,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.persona_drafts.get import (
    get_persona_drafts_entries_internal,
)
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.colors.get import get_colors_internal
from app.routes.v5.tools.resources.colors.search import search_colors_internal
from app.routes.v5.tools.resources.departments.get import get_departments_internal
from app.routes.v5.tools.resources.departments.search import search_departments_internal
from app.routes.v5.tools.resources.descriptions.get import get_descriptions_internal
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.examples.get import get_examples_internal
from app.routes.v5.tools.resources.examples.search import search_examples_internal
from app.routes.v5.tools.resources.fields.search import search_fields_internal
from app.routes.v5.tools.resources.flags.get import get_flags_internal
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.icons.get import get_icons_internal
from app.routes.v5.tools.resources.icons.search import search_icons_internal
from app.routes.v5.tools.resources.instructions.get import get_instructions_internal
from app.routes.v5.tools.resources.instructions.search import (
    search_instructions_internal,
)
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.parameter_fields.get import (
    get_parameter_fields_internal,
)
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.routes.v5.tools.resources.parameters.get import get_parameters_internal
from app.routes.v5.tools.resources.parameters.search import search_parameters_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.voices.get import get_voices_internal
from app.routes.v5.tools.resources.voices.search import search_voices_internal
from app.sql.types import (
    GetPersonaAccessSqlParams,
    GetPersonaAccessSqlRow,
    GetPersonaIdsSqlParams,
    GetPersonaIdsSqlRow,
    QGetParameterFieldsV4Item,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/personas/get_persona_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/personas/get_persona_ids_complete.sql"

router = APIRouter()


async def get_persona_internal(
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    parameter_ids: list[UUID] | None = None,
    # Search/filter kwargs (threaded from websocket artifact tool)
    color_search: str | None = None,
    icon_search: str | None = None,
    descriptions_search: str | None = None,
    instructions_search: str | None = None,
    parameter_field_search: str | None = None,
    color_show_selected: bool | None = None,
    icon_show_selected: bool | None = None,
    parameter_field_show_selected: bool | None = None,
    group_id: UUID | None = None,
) -> PersonaInternalData:
    """Core data fetching layer (cacheable).

    Fetches all persona data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_persona_websocket() - minimal data for WebSocket handlers
    - get_persona_client() - full BFF response for HTTP/frontend

    Args:
        profile_id: The authenticated user's profile ID
        persona_id: The persona ID to fetch (None for new persona mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        PersonaInternalData with all computed values

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve profile identity (access + hydrated departments/cohorts).
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    # Extract user context from profile (single source of truth)
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_persona_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # === GROUP ID: Use provided group_id, or fall back to draft/create ===
    if group_id:
        effective_group_id = group_id
    elif draft_item and draft_item.group_id:
        effective_group_id = draft_item.group_id
    else:
        async with pool.acquire() as c:
            effective_group_id = await c.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

    async with pool.acquire() as conn:
        query1_params = GetPersonaAccessSqlParams(
            profile_id=profile_id,
            persona_id=persona_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetPersonaAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        persona_department_ids = access_result.persona_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        # Early validation: check persona exists
        if persona_id is not None:
            if access_result.persona_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Persona {persona_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, persona_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this persona. It may be restricted to other departments.",
                )

        effective_draft_version = draft_item.version if draft_item is not None else None

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetPersonaIdsSqlParams(
            profile_id=profile_id,
            persona_id=persona_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetPersonaIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_color_id = ids_result.color_id
    selected_icon_id = ids_result.icon_id
    selected_instructions_id = ids_result.instructions_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_department_ids = ids_result.department_ids or []
    selected_parameter_field_ids = ids_result.parameter_field_ids or []
    selected_example_ids = ids_result.example_ids or []
    selected_voice_ids = ids_result.voice_ids or []

    # Draft values override canonical persona-junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.color_ids:
            selected_color_id = draft_item.color_ids[0]
        if draft_item.icon_ids:
            selected_icon_id = draft_item.icon_ids[0]
        if draft_item.instruction_ids:
            selected_instructions_id = draft_item.instruction_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]

        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.parameter_field_ids:
            selected_parameter_field_ids = draft_item.parameter_field_ids
        if draft_item.example_ids:
            selected_example_ids = draft_item.example_ids
        if hasattr(draft_item, "voice_ids") and draft_item.voice_ids:
            selected_voice_ids = draft_item.voice_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, tool_ids_map, _link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, PERSONA_RESOURCES
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")
    colors_has_tools = has_tools_for_resource(
        settings_data.agent_tool_entries, "colors"
    )
    icons_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "icons")
    instructions_has_tools = has_tools_for_resource(
        settings_data.agent_tool_entries, "instructions"
    )

    # Config chain resource IDs (only resolved agents, not all settings agents)
    selected_agent_ids = [aid for aid in agent_ids.values() if aid]
    config_agent_resource_ids = list(dict.fromkeys(selected_agent_ids))
    config_model_resource_ids = [
        a.model_id
        for a in settings_data.settings_agents
        if a.model_id and a.id in set(config_agent_resource_ids)
    ]
    # Provider IDs derived from models after fetch (sequential, not in gather)

    # === COMPUTE SHOW_AI_GENERATE FLAGS (BFF pattern - server computes, client consumes) ===
    # Per-resource show_ai_generate flags
    name_show_ai_generate = compute_show_ai_generate(agent_ids, "names")
    description_show_ai_generate = compute_show_ai_generate(agent_ids, "descriptions")
    color_show_ai_generate = compute_show_ai_generate(agent_ids, "colors")
    icon_show_ai_generate = compute_show_ai_generate(agent_ids, "icons")
    instructions_show_ai_generate = compute_show_ai_generate(agent_ids, "instructions")
    flag_show_ai_generate = compute_show_ai_generate(agent_ids, "flags")
    departments_show_ai_generate = compute_show_ai_generate(agent_ids, "departments")
    parameter_fields_show_ai_generate = compute_show_ai_generate(
        agent_ids, "parameter_fields"
    )
    examples_show_ai_generate = compute_show_ai_generate(agent_ids, "examples")
    parameters_show_ai_generate = compute_show_ai_generate(agent_ids, "parameters")
    voices_show_ai_generate = compute_show_ai_generate(agent_ids, "voices")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    content_show_ai_generate = any(
        [
            instructions_show_ai_generate,
            examples_show_ai_generate,
            voices_show_ai_generate,
        ]
    )
    parameters_step_show_ai_generate = any(
        [
            parameters_show_ai_generate,
            parameter_fields_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===

    # Compute permissions (simplified - no tools check needed for can_edit)
    can_edit = compute_can_edit(
        user_role=user_role,
        persona_department_ids=persona_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        persona_department_ids=persona_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    color_ids = [selected_color_id] if selected_color_id else []
    icon_ids = [selected_icon_id] if selected_icon_id else []
    instructions_ids = [selected_instructions_id] if selected_instructions_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    parameter_field_ids = selected_parameter_field_ids
    example_ids = selected_example_ids
    # parameter_ids comes from URL (function param), not from saved state
    parameter_ids = parameter_ids or []
    voice_ids_list = selected_voice_ids

    # Parallel fetch all resources
    # NOTE: Each query needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names(
                c, name_ids, get_redis_client(), bypass_cache=bypass_cache
            )
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, cache)
            suggestions = await search_descriptions_internal(
                c,
                descriptions_search,
                20,
                0,
                effective_group_id,
                "all",
                description_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_colors():
        async with pool.acquire() as c:
            selected = await get_colors_internal(c, color_ids, bypass_cache)
            suggestions = await search_colors_internal(
                c,
                color_search,
                20,
                0,
                effective_group_id,
                "selected" if color_show_selected else "all",
                color_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_icons():
        async with pool.acquire() as c:
            selected = await get_icons_internal(c, icon_ids, bypass_cache)
            suggestions = await search_icons_internal(
                c,
                icon_search,
                20,
                0,
                effective_group_id,
                "selected" if icon_show_selected else "all",
                icon_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_instructions():
        async with pool.acquire() as c:
            selected = await get_instructions_internal(
                c, instructions_ids, bypass_cache
            )
            suggestions = await search_instructions_internal(
                c,
                instructions_search,
                20,
                0,
                effective_group_id,
                "all",
                instructions_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    # Persona-specific flag types (business logic)
    PERSONA_FLAG_TYPES = {"persona_active"}

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                cache=cache,
                persona=True,
            )
            # Filter to only persona-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.type in PERSONA_FLAG_TYPES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            # Always use "all" to show all available departments the user has access to
            # This ensures users can see all options when editing, not just recently used ones
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_parameter_fields():
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(
                c, parameter_field_ids, bypass_cache
            )
            # Fetch available fields for the currently expanded parameters (from URL)
            available: list[QGetParameterFieldsV4Item] = []
            conditional_param_ids: list[UUID] = []
            if parameter_ids:
                available = await search_parameter_fields_internal(
                    c,
                    parameter_ids=parameter_ids,
                    bypass_cache=bypass_cache,
                )
                # Extract conditional parameter IDs from available fields
                # These are "next" parameters the client can explore
                conditional_param_ids = list(
                    {
                        UUID(str(f.conditional_parameter_id))
                        for f in available
                        if f.conditional_parameter_id
                    }
                )
            return (selected, available, conditional_param_ids)

    async def fetch_fields():
        async with pool.acquire() as c:
            return await search_fields_internal(
                c,
                search=None,
                limit_count=200,
                offset_count=0,
                department_ids=user_department_ids,
                bypass_cache=bypass_cache,
            )

    async def fetch_examples():
        async with pool.acquire() as c:
            selected = await get_examples_internal(c, example_ids, bypass_cache)
            suggestions = await search_examples_internal(
                c,
                None,
                20,
                0,
                persona_id,
                user_department_ids,
                effective_group_id,
                "all",
                example_ids,
                bypass_cache,
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_parameters():
        async with pool.acquire() as c:
            # Fetch parameters for the URL-expanded IDs (includes conditional params)
            selected = await get_parameters_internal(
                c,
                parameter_ids,
                bypass_cache,
            )
            # Suggest persona_parameter=true params not yet expanded
            suggestions = await search_parameters_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                persona_parameter=True,
                document_parameter=None,
                scenario_parameter=None,
                video_parameter=None,
                suggest_source="all",
                exclude_ids=parameter_ids,
                bypass_cache=bypass_cache,
                persona=False,
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
            )
            return (selected, suggestions)

    async def fetch_config_agents():
        async with pool.acquire() as c:
            return await get_agents_internal(c, config_agent_resource_ids, bypass_cache)

    async def fetch_config_models():
        async with pool.acquire() as c:
            return await get_models_internal(c, config_model_resource_ids, bypass_cache)

    # === PARALLEL FETCH (all resources at once) ===
    # Fields are now a top-level catalog resource. Parameters carry field_ids and
    # fields carry conditional_parameter_ids, so no two-phase fetch is needed.
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (colors_selected, colors_suggestions),
        (icons_selected, icons_suggestions),
        (instructions_selected, instructions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (parameter_fields_selected, parameter_fields_available, conditional_param_ids),
        (examples_selected, examples_suggestions),
        (parameters_selected, parameters_suggestions),
        (voices_selected, voices_suggestions),
        fields_catalog,
        config_agents_result,
        config_models_result,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_colors(),
        fetch_icons(),
        fetch_instructions(),
        fetch_flags(),
        fetch_departments(),
        fetch_parameter_fields(),
        fetch_examples(),
        fetch_parameters(),
        fetch_voices(),
        fetch_fields(),
        fetch_config_agents(),
        fetch_config_models(),
    )

    # Derive providers from fetched models (must be sequential)
    config_provider_ids = list(
        dict.fromkeys(
            m.provider_id for m in (config_models_result or []) if m.provider_id
        )
    )
    config_providers_result: list[Any] = []
    if config_provider_ids:
        async with pool.acquire() as c:
            config_providers_result = await get_providers_internal(
                c, config_provider_ids, bypass_cache
            )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    colors = _dedupe_by_id(colors_selected + colors_suggestions, "id")
    icons = _dedupe_by_id(icons_selected + icons_suggestions, "id")
    instructions_list = _dedupe_by_id(
        instructions_selected + instructions_suggestions, "id"
    )
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    examples = _dedupe_by_id(examples_selected + examples_suggestions, "id")
    parameters = _dedupe_by_id(
        parameters_selected + parameters_suggestions,
        "parameter_id",
    )
    # Fetch conditional parameter metadata (names for "next" parameters revealed by fields)
    existing_param_ids = {p.parameter_id for p in parameters if p.parameter_id}
    missing_conditional_ids = [
        pid for pid in conditional_param_ids if pid not in existing_param_ids
    ]
    if missing_conditional_ids:
        async with pool.acquire() as c:
            conditional_params = await get_parameters_internal(
                c, missing_conditional_ids, bypass_cache
            )
            parameters = _dedupe_by_id(parameters + conditional_params, "parameter_id")
    voices = _dedupe_by_id(voices_selected + voices_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    color_resource = next((c for c in colors if c.id == selected_color_id), None)
    icon_resource = next((i for i in icons if i.id == selected_icon_id), None)
    instructions_resource = next(
        (i for i in instructions_list if i.id == selected_instructions_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    parameter_field_resources = parameter_fields_selected
    resolved_parameter_ids = list(
        {str(pf.parameter_id) for pf in parameter_field_resources if pf.parameter_id}
    )
    example_resources = [e for e in examples if e.id in selected_example_ids]
    parameter_resources = [p for p in parameters if p.parameter_id in parameter_ids]
    voice_resources = [v for v in voices if v.id in selected_voice_ids]

    name_suggestions = [n.id for n in names_suggestions]
    description_suggestions = [d.id for d in descriptions_suggestions]
    color_suggestions = [c.id for c in colors_suggestions]
    icon_suggestions = [i.id for i in icons_suggestions]
    instructions_suggestions_ids = [i.id for i in instructions_suggestions]
    department_suggestions = [d.department_id for d in departments_suggestions]
    parameter_field_suggestions: list[UUID] = []
    example_suggestions = [e.id for e in examples_suggestions]
    parameter_suggestions = [p.parameter_id for p in parameters_suggestions]
    voice_suggestions_ids = [v.id for v in voices_suggestions]

    # Compute final show flags based on actual data
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_color = compute_show_color(colors_has_tools, len(colors))
    show_icon = compute_show_icon(icons_has_tools, len(icons))
    show_instructions_flag = compute_show_instructions(instructions_has_tools)
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_parameter_fields_flag = compute_show_parameter_fields(len(fields_catalog))
    show_examples_flag = compute_show_examples(len(examples))
    show_parameters_flag = compute_show_parameters(len(parameters))
    show_voices_flag = compute_show_voices(len(voices))

    # Build show and required flags maps for domain_data
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "colors": show_color,
        "icons": show_icon,
        "instructions": show_instructions_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "parameter_fields": show_parameter_fields_flag,
        "examples": show_examples_flag,
        "parameters": show_parameters_flag,
        "voices": show_voices_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "colors": compute_color_required(),
        "icons": compute_icon_required(),
        "instructions": compute_instructions_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "parameter_fields": compute_parameter_fields_required(),
        "examples": compute_examples_required(),
        "parameters": compute_parameters_required(),
        "voices": compute_voices_required(),
    }

    # Transform flags to enriched format for client (canonical pattern)
    persona_flags = [
        PersonaFlagConfig(
            key=flag.name,
            label=flag.name,
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    # Convert current flag_resource to PersonaFlagConfig for the current bucket (canonical pattern)
    current_flag_config: PersonaFlagConfig | None = None
    if flag_resource and flag_resource.id:
        current_flag_config = PersonaFlagConfig(
            key=flag_resource.name,
            label=flag_resource.name,
            description=flag_resource.description,
            icon_id=flag_resource.icon,
            flag_option_id=flag_resource.id,
            generated=flag_resource.generated,
        )

    # Validation for new mode
    if persona_id is None:
        # New mode: check for valid departments
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Detail mode: check access via name_resource
    if persona_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this persona. It may be restricted to other departments.",
        )

    # === Construct Response ===
    resources_payload = PersonaResources(
        resources=PersonaResourceBucket(
            names=names,
            descriptions=descriptions,
            colors=colors,
            icons=icons,
            instructions=instructions_list,
            flags=persona_flags,
            departments=departments,
            parameter_fields=parameter_fields_available,
            examples=examples,
            parameters=parameters,
            voices=voices,
            fields=fields_catalog,
        ),
        current=PersonaResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            colors=[color_resource] if color_resource else [],
            icons=[icon_resource] if icon_resource else [],
            instructions=[instructions_resource] if instructions_resource else [],
            flags=[current_flag_config] if current_flag_config else [],
            departments=department_resources or [],
            parameter_fields=parameter_field_resources or [],
            examples=example_resources or [],
            parameters=parameter_resources or [],
            voices=voice_resources or [],
            fields=None,
        ),
    )

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "colors": color_show_ai_generate,
        "icons": icon_show_ai_generate,
        "instructions": instructions_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "parameter_fields": parameter_fields_show_ai_generate,
        "examples": examples_show_ai_generate,
        "parameters": parameters_show_ai_generate,
        "voices": voices_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map = {
        "names": name_suggestions,
        "descriptions": description_suggestions,
        "colors": color_suggestions,
        "icons": icon_suggestions,
        "instructions": instructions_suggestions_ids,
        "departments": department_suggestions,
        "parameter_fields": parameter_field_suggestions,
        "examples": example_suggestions,
        "parameters": parameter_suggestions,
        "voices": voice_suggestions_ids,
    }

    return PersonaInternalData(
        # Access/context
        actor_name=actor_name,
        persona_exists=access_result.persona_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Agent mappings
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        parameters_step_show_ai_generate=parameters_step_show_ai_generate,
        # Resolved parameter IDs
        resolved_parameter_ids=resolved_parameter_ids,
        # Resources
        resources_payload=resources_payload,
        # Per-resource tool IDs
        tool_ids_map=tool_ids_map,
        # Config resources
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_persona_websocket(
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    # Search/filter kwargs (from artifact tool calls)
    color_search: str | None = None,
    icon_search: str | None = None,
    descriptions_search: str | None = None,
    instructions_search: str | None = None,
    parameter_field_search: str | None = None,
    parameter_ids: list[UUID] | None = None,
    color_show_selected: bool | None = None,
    icon_show_selected: bool | None = None,
    parameter_field_show_selected: bool | None = None,
) -> GetPersonaWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Wraps get_persona_internal() for shared resource fetching (Q1, Q2, Pass 2),
    then reshapes into views + resources format. Additionally:
    - Fetches draft persona view (convenience for Jinja templates, NOT source of truth)
    - Hydrates tools from config agent's tool_ids
    """
    data = await get_persona_internal(
        profile_id=profile_id,
        persona_id=persona_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        parameter_ids=parameter_ids,
        color_search=color_search,
        icon_search=icon_search,
        descriptions_search=descriptions_search,
        instructions_search=instructions_search,
        parameter_field_search=parameter_field_search,
        color_show_selected=color_show_selected,
        icon_show_selected=icon_show_selected,
        parameter_field_show_selected=parameter_field_show_selected,
    )

    # Fetch draft persona view, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_persona_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def fetch_runs_today():
        if not pool:
            return None
        from datetime import datetime

        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as conn:
            return await get_run_list_entries_internal(
                conn=conn,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    async def fetch_tools():
        if not data.config_agent_resources or not pool:
            return []
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if not deduped_tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools(
                c, deduped_tool_ids, get_redis_client(), bypass_cache=bypass_cache
            )

    (
        draft_persona,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    all_resources = data.resources_payload.resources

    # Enrich tools with args and args_outputs
    config_tools = tools_result or []
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)
        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c,
                        list(set(all_args_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c,
                        list(set(all_args_output_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build entries (always construct — both fields optional now)
    entries = PersonaWebsocketEntries(
        draft_persona=draft_persona,
        runs=runs_result,
    )

    return GetPersonaWebsocketResponse(
        entries=entries if draft_persona or runs_result else None,
        resources=PersonaWebsocketResources(
            names=all_resources.names if all_resources else None,
            descriptions=all_resources.descriptions if all_resources else None,
            colors=all_resources.colors if all_resources else None,
            icons=all_resources.icons if all_resources else None,
            instructions=all_resources.instructions if all_resources else None,
            flags=all_resources.flags if all_resources else None,
            departments=all_resources.departments if all_resources else None,
            parameter_fields=all_resources.parameter_fields if all_resources else None,
            examples=all_resources.examples if all_resources else None,
            parameters=all_resources.parameters if all_resources else None,
            voices=all_resources.voices if all_resources else None,
            fields=all_resources.fields if all_resources else None,
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetPersonaApiRequest(
            persona_id=persona_id,
            draft_id=draft_id,
            color_search=color_search,
            icon_search=icon_search,
            descriptions_search=descriptions_search,
            instructions_search=instructions_search,
            parameter_field_search=parameter_field_search,
            parameter_ids=[str(pid) for pid in parameter_ids]
            if parameter_ids
            else None,
            color_show_selected=color_show_selected,
            icon_show_selected=icon_show_selected,
            parameter_field_show_selected=parameter_field_show_selected,
        ),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_persona_client(
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    parameter_ids: list[UUID] | None = None,
    group_id: UUID | None = None,
) -> GetPersonaApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags. Does NOT include domains
    (agent lookup is server-side only).
    """
    data = await get_persona_internal(
        profile_id=profile_id,
        persona_id=persona_id,
        draft_id=draft_id,
        cache=cache,
        parameter_ids=parameter_ids,
        group_id=group_id,
    )

    all_resources = data.resources_payload.resources
    current = data.resources_payload.current

    def _section_common(resource_key: str) -> dict:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "tool_id": data.tool_ids_map.get(resource_key),
        }

    return GetPersonaApiResponse(
        # Context
        actor_name=data.actor_name,
        persona_exists=data.persona_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        content_show_ai_generate=data.content_show_ai_generate,
        parameters_step_show_ai_generate=data.parameters_step_show_ai_generate,
        # Per-resource sections
        names=PersonaNameSection(
            **_section_common("names"),
            resource=(current.names[0] if current and current.names else None),
            resources=all_resources.names if all_resources else [],
        ),
        descriptions=PersonaDescriptionSection(
            **_section_common("descriptions"),
            resource=(
                current.descriptions[0] if current and current.descriptions else None
            ),
            resources=all_resources.descriptions if all_resources else [],
        ),
        colors=PersonaColorSection(
            **_section_common("colors"),
            resource=(current.colors[0] if current and current.colors else None),
            resources=all_resources.colors if all_resources else [],
        ),
        icons=PersonaIconSection(
            **_section_common("icons"),
            resource=(current.icons[0] if current and current.icons else None),
            resources=all_resources.icons if all_resources else [],
        ),
        instructions=PersonaInstructionSection(
            **_section_common("instructions"),
            resource=(
                current.instructions[0] if current and current.instructions else None
            ),
            resources=all_resources.instructions if all_resources else [],
        ),
        flags=PersonaFlagSection(
            **_section_common("flags"),
            current=(current.flags[0] if current and current.flags else None),
            resources=all_resources.flags if all_resources else [],
        ),
        departments=PersonaDepartmentSection(
            **_section_common("departments"),
            current=current.departments if current else [],
            resources=all_resources.departments if all_resources else [],
        ),
        parameter_fields=PersonaParameterFieldSection(
            **_section_common("parameter_fields"),
            current=current.parameter_fields if current else [],
            resources=(all_resources.parameter_fields if all_resources else []),
        ),
        examples=PersonaExampleSection(
            **_section_common("examples"),
            current=current.examples if current else [],
            resources=all_resources.examples if all_resources else [],
        ),
        parameters=PersonaParameterSection(
            **_section_common("parameters"),
            current=current.parameters if current else [],
            resources=all_resources.parameters if all_resources else [],
        ),
        voices=PersonaVoiceSection(
            **_section_common("voices"),
            current=current.voices if current else [],
            resources=all_resources.voices if all_resources else [],
        ),
        # Fields catalog
        fields=all_resources.fields if all_resources else [],
        # Resolved parameter IDs (derived from saved parameter_fields)
        resolved_parameter_ids=data.resolved_parameter_ids or None,
    )


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


@router.post("/get", response_model=GetPersonaApiResponse)
async def get_persona(
    request: GetPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaApiResponse:
    """Get persona information using two-pass architecture.

    This is a thin HTTP wrapper around get_persona_internal().

    Query 1: Access check (user role, departments, persona state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Call the client (BFF) function
        response_data = await get_persona_client(
            profile_id=profile_id,
            persona_id=request.persona_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            parameter_ids=[UUID(pid) for pid in request.parameter_ids]
            if request.parameter_ids
            else None,
            group_id=request.group_id,
        )

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "personas"
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
            operation="get_persona",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

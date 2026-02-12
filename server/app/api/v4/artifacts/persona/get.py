"""Persona get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_persona_internal() - Core data fetching (cacheable, returns dataclass)
2. get_persona_websocket() - Minimal data for WebSocket handlers
3. get_persona_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
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
    derive_flag_key_and_label,
    has_access,
)
from app.api.v4.artifacts.persona.types import (
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
    PersonaWebsocketResources,
    PersonaWebsocketViews,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.colors.search import search_colors_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.examples.get import get_examples_internal
from app.api.v4.resources.examples.search import search_examples_internal
from app.api.v4.resources.fields.search import search_fields_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.icons.get import get_icons_internal
from app.api.v4.resources.icons.search import search_icons_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.instructions.search import search_instructions_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.parameters.search import search_parameters_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_persona_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetPersonaAccessSqlParams,
    GetPersonaAccessSqlRow,
    GetPersonaIdsSqlParams,
    GetPersonaIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/personas/get_persona_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/personas/get_persona_ids_complete.sql"

router = APIRouter()


async def get_persona_internal(
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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

    # Resolve shared profile context first (default path).
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(
            conn=context_conn,
            profile_id=profile_id,
            department_id_cookie=None,
            bypass_cache=bypass_cache,
        )

    # Extract user context from internal fetch (single source of truth)
    user_role = resolved_context.user_role
    actor_name = resolved_context.actor_name
    user_department_ids = [
        d.department_id for d in resolved_context.departments if d.department_id
    ]

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_persona_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

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

        effective_group_id = (
            draft_item.group_id
            if draft_item is not None and draft_item.group_id is not None
            else access_result.group_id
        )
        effective_draft_version = (
            draft_item.version
            if draft_item is not None
            else access_result.draft_version
        )

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
    selected_parameter_ids = ids_result.parameter_ids or []

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
        if draft_item.parameter_ids:
            selected_parameter_ids = draft_item.parameter_ids

    # Config chain resource IDs (for pre-fetched generation config)
    config_agent_resource_ids = ids_result.config_agent_resource_ids or []
    config_model_resource_ids = ids_result.config_model_resource_ids or []
    config_provider_resource_ids = ids_result.config_provider_resource_ids or []

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    colors_has_tools = ids_result.colors_has_tools or False
    icons_has_tools = ids_result.icons_has_tools or False
    instructions_has_tools = ids_result.instructions_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(PERSONA_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=PERSONA_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    # For each resource, find the selected agent and extract its tool IDs
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in PERSONA_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            # Find the candidate agent with this ID
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

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
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        persona_department_ids=persona_department_ids,
        active_scenario_count=active_scenario_count,
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
    parameter_ids = selected_parameter_ids

    # Parallel fetch all resources
    # NOTE: Each query needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.

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
                persona=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, bypass_cache)
            suggestions = await search_descriptions_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_colors():
        async with pool.acquire() as c:
            selected = await get_colors_internal(c, color_ids, bypass_cache)
            suggestions = await search_colors_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                effective_group_id,
                "recent",
                color_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_icons():
        async with pool.acquire() as c:
            selected = await get_icons_internal(c, icon_ids, bypass_cache)
            suggestions = await search_icons_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                effective_group_id,
                "recent",
                icon_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_instructions():
        async with pool.acquire() as c:
            selected = await get_instructions_internal(
                c, instructions_ids, bypass_cache
            )
            suggestions = await search_instructions_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                effective_group_id,
                "recent",
                instructions_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    # Persona-specific flag names (business logic)
    PERSONA_FLAG_NAMES = {"persona_active"}

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                artifact_type="persona",
            )
            # Filter to only persona-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.name in PERSONA_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            # Always use "all" to show all available departments the user has access to
            # This ensures users can see all options when editing, not just recently used ones
            suggestions = await search_departments_internal(
                c,
                None,
                20,
                0,
                user_department_ids,
                "all",
                department_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_parameter_fields():
        async with pool.acquire() as c:
            return await get_parameter_fields_internal(
                c, parameter_field_ids, bypass_cache
            )

    async def fetch_fields():
        async with pool.acquire() as c:
            return await search_fields_internal(
                c,
                search=None,
                limit_count=200,
                offset_count=0,
                user_department_ids=user_department_ids,
                bypass_cache=bypass_cache,
            )

    async def fetch_examples():
        async with pool.acquire() as c:
            selected = await get_examples_internal(c, example_ids, bypass_cache)
            example_source = "all" if persona_id is None else "recent"
            suggestions = await search_examples_internal(
                c,
                None,
                20,
                0,
                persona_id,
                user_department_ids,
                effective_group_id,
                example_source,
                example_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_parameters():
        async with pool.acquire() as c:
            selected = await get_parameters_internal(
                c,
                parameter_ids,
                bypass_cache,
                persona_parameter=True,  # Only fetch persona parameters
            )
            suggestions = await search_parameters_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                True,
                None,
                None,
                None,
                "all",
                parameter_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_config_agents():
        async with pool.acquire() as c:
            return await get_agents_internal(c, config_agent_resource_ids, bypass_cache)

    async def fetch_config_models():
        async with pool.acquire() as c:
            return await get_models_internal(c, config_model_resource_ids, bypass_cache)

    async def fetch_config_providers():
        async with pool.acquire() as c:
            return await get_providers_internal(
                c, config_provider_resource_ids, bypass_cache
            )

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
        parameter_fields_selected,
        (examples_selected, examples_suggestions),
        (parameters_selected, parameters_suggestions),
        fields_catalog,
        config_agents_result,
        config_models_result,
        config_providers_result,
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
        fetch_fields(),
        fetch_config_agents(),
        fetch_config_models(),
        fetch_config_providers(),
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
    example_resources = [e for e in examples if e.id in selected_example_ids]
    parameter_resources = [
        p for p in parameters if p.parameter_id in selected_parameter_ids
    ]

    name_suggestions = [n.id for n in names_suggestions]
    description_suggestions = [d.id for d in descriptions_suggestions]
    color_suggestions = [c.id for c in colors_suggestions]
    icon_suggestions = [i.id for i in icons_suggestions]
    instructions_suggestions_ids = [i.id for i in instructions_suggestions]
    department_suggestions = [d.department_id for d in departments_suggestions]
    parameter_field_suggestions: list[UUID] = []
    example_suggestions = [e.id for e in examples_suggestions]
    parameter_suggestions = [p.parameter_id for p in parameters_suggestions]

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
    }

    # Transform flags to enriched format for client
    persona_flags = [
        PersonaFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
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
            parameter_fields=parameter_fields_selected,
            examples=examples,
            parameters=parameters,
            fields=fields_catalog,
        ),
        current=PersonaResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            colors=[color_resource] if color_resource else [],
            icons=[icon_resource] if icon_resource else [],
            instructions=[instructions_resource] if instructions_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            parameter_fields=parameter_field_resources or [],
            examples=example_resources or [],
            parameters=parameter_resources or [],
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
        # Resources
        resources_payload=resources_payload,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
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
    )

    # Fetch draft persona view for Jinja template convenience
    draft_persona = None
    if draft_id:
        pool = get_pool()
        if pool:
            async with pool.acquire() as conn:
                draft_items = await get_draft_persona_internal(
                    conn=conn,
                    draft_ids=[draft_id],
                    bypass_cache=bypass_cache,
                )
                if draft_items:
                    draft_persona = draft_items[0]

    # Hydrate tools from config agent's tool_ids
    tools_result: list = []
    if data.config_agent_resources:
        agent_resource = data.config_agent_resources[0]
        if agent_resource and agent_resource.tool_ids:
            pool = get_pool()
            if pool:
                async with pool.acquire() as c:
                    tools_result = await get_tools_internal(
                        c, list(agent_resource.tool_ids), bypass_cache
                    )

    # Extract current (selected) resources from internal data
    current = data.resources_payload.current

    # Get enriched flags for the selected flag(s)
    # current.flags contains raw flag objects; resources.flags has enriched PersonaFlagConfig
    selected_flag_ids = set()
    if current and current.flags:
        for f in current.flags:
            fid = getattr(f, "flag_option_id", None) or getattr(f, "id", None)
            if fid:
                selected_flag_ids.add(fid)
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    return GetPersonaWebsocketResponse(
        views=PersonaWebsocketViews(draft_persona=draft_persona)
        if draft_persona
        else None,
        resources=PersonaWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            colors=current.colors if current else None,
            icons=current.icons if current else None,
            instructions=current.instructions if current else None,
            flags=selected_enriched_flags or None,
            departments=current.departments if current else None,
            parameter_fields=current.parameter_fields if current else None,
            examples=current.examples if current else None,
            parameters=current.parameters if current else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_persona_client(
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
        bypass_cache=bypass_cache,
    )

    all_resources = data.resources_payload.resources
    current = data.resources_payload.current

    def _section_common(resource_key: str) -> dict:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
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
        # Fields catalog
        fields=all_resources.fields if all_resources else [],
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


@router.post(
    "/get",
    response_model=GetPersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.get",
            "{{ actor.name }} {% if persona %}viewed{% else %}opened new{% endif %} persona{% if persona %} '{{ persona.name }}'{% endif %}",
        )
    ],
)
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
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            if response_data.names and response_data.names.resource:
                current_name = getattr(response_data.names.resource, "name", None)
            if request.persona_id and current_name:
                audit_ctx["persona"] = {
                    "name": current_name,
                    "id": str(request.persona_id),
                }
            audit_set(http_request, **audit_ctx)

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

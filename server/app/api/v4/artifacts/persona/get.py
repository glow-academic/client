"""Persona get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Query 1: Access check (user context, persona state)
2. Query 2: ID fetching (resource IDs, suggestions, agents)
3. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
    PERSONA_BASIC_RESOURCES,
    PERSONA_CONTENT_RESOURCES,
    PERSONA_PARAMETERS_RESOURCES,
    PERSONA_RESOURCES,
    CandidateAgent,
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
    has_access,
    select_agents_for_artifact,
    select_multi_resource_agent,
)
from app.api.v4.artifacts.persona.types import (
    GetPersonaApiRequest,
    GetPersonaApiResponse,
    PersonaFlagConfig,
)
from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.colors.search import search_colors_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.examples.get import get_examples_internal
from app.api.v4.resources.examples.search import search_examples_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.icons.get import get_icons_internal
from app.api.v4.resources.icons.search import search_icons_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.instructions.search import search_instructions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.parameters.search import (
    search_conditional_parameters_internal,
    search_parameters_internal,
)
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
) -> GetPersonaApiResponse:
    """Internal function to fetch persona data using two-pass architecture.

    This is the core logic extracted for reuse by both the HTTP endpoint
    and the WebSocket generate handler.

    Args:
        profile_id: The authenticated user's profile ID
        persona_id: The persona ID to fetch (None for new persona mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        GetPersonaApiResponse with all persona data

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """
    from app.main import get_pool

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

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

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
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

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetPersonaIdsSqlParams(
            profile_id=profile_id,
            persona_id=persona_id,
            draft_id=draft_id,
            group_id=access_result.group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetPersonaIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    colors_has_tools = ids_result.colors_has_tools or False
    icons_has_tools = ids_result.icons_has_tools or False
    instructions_has_tools = ids_result.instructions_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    # Composite type returns as Record with named fields
    candidate_agents = [
        CandidateAgent(
            agent_id=ca["agent_id"],
            agent_name=ca["agent_name"],
            tool_resources=set(ca["tool_resources"] or []),
            department_ids=set(ca["department_ids"] or []),
            updated_at=ca["updated_at"],
            is_active=True,  # Query 2 only returns active agents
            is_mcp=ca["is_mcp"] or False,
        )
        for ca in (ids_result.candidate_agents or [])
    ]

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

    # Extract agent IDs for each resource
    name_agent_id = agent_ids.get("names")
    description_agent_id = agent_ids.get("descriptions")
    color_agent_id = agent_ids.get("colors")
    icon_agent_id = agent_ids.get("icons")
    instructions_agent_id = agent_ids.get("instructions")
    flag_agent_id = agent_ids.get("flags")
    departments_agent_id = agent_ids.get("departments")
    parameter_fields_agent_id = agent_ids.get("parameter_fields")
    examples_agent_id = agent_ids.get("examples")
    parameters_agent_id = agent_ids.get("parameters")

    # Multi-resource agent IDs
    basic_agent_id = select_multi_resource_agent(
        candidate_agents, PERSONA_BASIC_RESOURCES, PERSONA_RESOURCES, user_dept_set
    )
    content_agent_id = select_multi_resource_agent(
        candidate_agents,
        PERSONA_CONTENT_RESOURCES,
        PERSONA_RESOURCES,
        user_dept_set,
    )
    parameters_step_agent_id = select_multi_resource_agent(
        candidate_agents,
        PERSONA_PARAMETERS_RESOURCES,
        PERSONA_RESOURCES,
        user_dept_set,
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
    name_ids = [ids_result.name_id] if ids_result.name_id else []
    description_ids = [ids_result.description_id] if ids_result.description_id else []
    color_ids = [ids_result.color_id] if ids_result.color_id else []
    icon_ids = [ids_result.icon_id] if ids_result.icon_id else []
    instructions_ids = (
        [ids_result.instructions_id] if ids_result.instructions_id else []
    )
    flag_ids = [ids_result.active_flag_id] if ids_result.active_flag_id else []
    department_ids = ids_result.department_ids or []
    parameter_field_ids = ids_result.parameter_field_ids or []
    example_ids = ids_result.example_ids or []
    parameter_ids = ids_result.parameter_ids or []

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
                access_result.group_id,
                "recent",
                name_ids,
                bypass_cache,
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
                access_result.group_id,
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
                access_result.group_id,
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
                access_result.group_id,
                "recent",
                icon_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_instructions():
        async with pool.acquire() as c:
            selected = await get_instructions_internal(c, instructions_ids, bypass_cache)
            suggestions = await search_instructions_internal(
                c,
                None,  # No search filter for internal calls
                20,
                0,
                access_result.group_id,
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

    async def fetch_parameter_fields(param_ids: list[UUID]):
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(
                c, parameter_field_ids, bypass_cache
            )
            # Get all available fields for ALL parameters (persona + conditional)
            # This enables instant UI when user selects a parameter
            available = await search_parameter_fields_internal(c, param_ids, bypass_cache)
            return (selected, available)

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
                access_result.group_id,
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

    # === TWO-PHASE FETCH ===
    # Phase 1a: Fetch persona parameters FIRST to get all persona parameter IDs
    # This is needed because parameter_fields needs to know which parameters to scope to
    (parameters_selected, parameters_suggestions) = await fetch_parameters()

    # Extract ALL persona parameter IDs (both selected and available)
    all_persona_parameter_ids = list(
        {p.parameter_id for p in parameters_selected}
        | {p.parameter_id for p in parameters_suggestions}
    )

    # Phase 1b: Fetch ALL conditional parameters transitively
    # This uses a recursive approach to find the full chain (e.g., Persona Type -> Temperament -> Intensity)
    async def fetch_conditional_parameters():
        async with pool.acquire() as c:
            return await search_conditional_parameters_internal(
                c,
                [pid for pid in all_persona_parameter_ids if pid is not None],
                bypass_cache,
            )

    conditional_params = await fetch_conditional_parameters()

    # Combine ALL parameter IDs for Phase 2 (includes transitive conditional params)
    all_parameter_ids = list(
        set(
            all_persona_parameter_ids
            + [p.parameter_id for p in conditional_params if p.parameter_id]
        )
    )

    # Phase 2: Fetch remaining resources in parallel (including parameter_fields with proper IDs)
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (colors_selected, colors_suggestions),
        (icons_selected, icons_suggestions),
        (instructions_selected, instructions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (parameter_fields_selected, parameter_fields_suggestions),
        (examples_selected, examples_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_colors(),
        fetch_icons(),
        fetch_instructions(),
        fetch_flags(),
        fetch_departments(),
        fetch_parameter_fields([pid for pid in all_parameter_ids if pid is not None]),
        fetch_examples(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(
        descriptions_selected + descriptions_suggestions, "id"
    )
    colors = _dedupe_by_id(colors_selected + colors_suggestions, "id")
    icons = _dedupe_by_id(icons_selected + icons_suggestions, "id")
    instructions_list = _dedupe_by_id(
        instructions_selected + instructions_suggestions, "id"
    )
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    # Dedupe by field_id since selected resources use parameter_fields_resource.id
    # while available fields use field_id as their id
    parameter_fields = _dedupe_by_id(
        parameter_fields_selected + parameter_fields_suggestions, "field_id"
    )
    examples = _dedupe_by_id(examples_selected + examples_suggestions, "id")
    # Combine persona parameters with conditional parameters (conditional params have conditional=true)
    parameters = _dedupe_by_id(
        parameters_selected + parameters_suggestions + conditional_params,
        "parameter_id",
    )

    # Find selected resources
    name_resource = next((n for n in names if n.id == ids_result.name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == ids_result.description_id),
        None,
    )
    color_resource = next((c for c in colors if c.id == ids_result.color_id), None)
    icon_resource = next((i for i in icons if i.id == ids_result.icon_id), None)
    instructions_resource = next(
        (i for i in instructions_list if i.id == ids_result.instructions_id),
        None,
    )
    flag_resource = next(
        (f for f in flags if f.id == ids_result.active_flag_id), None
    )

    # Selected department/parameter_field/example/parameter resources
    selected_department_ids = ids_result.department_ids or []
    selected_parameter_field_ids = ids_result.parameter_field_ids or []
    selected_example_ids = ids_result.example_ids or []
    selected_parameter_ids = ids_result.parameter_ids or []

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    parameter_field_resources = [
        f for f in parameter_fields if f.id in selected_parameter_field_ids
    ]
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
    parameter_field_suggestions = [f.id for f in parameter_fields_suggestions]
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
    show_parameter_fields_flag = compute_show_parameter_fields(len(parameter_fields))
    show_examples_flag = compute_show_examples(len(examples))
    show_parameters_flag = compute_show_parameters(len(parameters))

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
            agent_id=flag_agent_id,
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
    return GetPersonaApiResponse(
        # Required fields
        actor_name=access_result.actor_name,
        persona_exists=access_result.persona_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=access_result.draft_version,
        group_id=access_result.group_id,
        # Name
        name_id=ids_result.name_id,
        name_resource=name_resource,
        show_name=show_name,
        name_agent_id=name_agent_id,  # Python-computed
        name_required=compute_name_required(),
        name_suggestions=name_suggestions,
        names=names,
        # Description
        description_id=ids_result.description_id,
        description_resource=description_resource,
        show_description=show_description_flag,
        description_agent_id=description_agent_id,  # Python-computed
        description_required=compute_description_required(),
        description_suggestions=description_suggestions,
        descriptions=descriptions,
        # Color
        color_id=ids_result.color_id,
        color_resource=color_resource,
        show_color=show_color,
        color_agent_id=color_agent_id,  # Python-computed
        color_required=compute_color_required(),
        color_suggestions=color_suggestions,
        colors=colors,
        # Icon
        icon_id=ids_result.icon_id,
        icon_resource=icon_resource,
        show_icon=show_icon,
        icon_agent_id=icon_agent_id,  # Python-computed
        icon_required=compute_icon_required(),
        icon_suggestions=icon_suggestions,
        icons=icons,
        # Instructions
        instructions_id=ids_result.instructions_id,
        instructions_resource=instructions_resource,
        show_instructions=show_instructions_flag,
        instructions_agent_id=instructions_agent_id,  # Python-computed
        instructions_required=compute_instructions_required(),
        instructions_suggestions=instructions_suggestions_ids,
        instructions=instructions_list,
        # Flag
        active_flag_id=ids_result.active_flag_id,
        flag_resource=flag_resource,
        show_flag=show_flag,
        flag_agent_id=flag_agent_id,  # Python-computed
        flag_required=compute_flag_required(),
        flags=persona_flags,
        # Departments
        department_ids=ids_result.department_ids,
        department_resources=department_resources,
        show_departments=show_departments_flag,
        departments_agent_id=departments_agent_id,  # Python-computed
        departments_required=compute_departments_required(),
        department_suggestions=department_suggestions,
        departments=departments,
        # Parameter Fields
        parameter_field_ids=ids_result.parameter_field_ids,
        parameter_field_resources=parameter_field_resources,
        show_parameter_fields=show_parameter_fields_flag,
        parameter_fields_agent_id=parameter_fields_agent_id,  # Python-computed
        parameter_fields_required=compute_parameter_fields_required(),
        parameter_field_suggestions=parameter_field_suggestions,
        parameter_fields=parameter_fields,
        # Examples
        example_ids=ids_result.example_ids,
        example_resources=example_resources,
        show_examples=show_examples_flag,
        examples_agent_id=examples_agent_id,  # Python-computed
        examples_required=compute_examples_required(),
        example_suggestions=example_suggestions,
        examples=examples,
        # Parameters
        parameter_ids=ids_result.parameter_ids,
        parameter_resources=parameter_resources,
        show_parameters=show_parameters_flag,
        parameters_agent_id=parameters_agent_id,  # Python-computed
        parameters_required=compute_parameters_required(),
        parameter_suggestions=parameter_suggestions,
        parameters=parameters,
        # Multi-resource agent IDs (Python-computed)
        basic_agent_id=basic_agent_id,
        content_agent_id=content_agent_id,
        parameters_step_agent_id=parameters_step_agent_id,
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'persona_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    # Remove artifact prefix (e.g., 'persona_active' -> 'active')
    key = name.replace("persona_", "")
    # Title case for label
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

        # Call the internal function
        response_data = await get_persona_internal(
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
            if (
                request.persona_id
                and response_data.name_resource
                and response_data.name_resource.name
            ):
                audit_ctx["persona"] = {
                    "name": response_data.name_resource.name,
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

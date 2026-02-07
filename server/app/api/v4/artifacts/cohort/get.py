"""Cohort get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Query 1: Access check (user context, cohort state)
2. Query 2: ID fetching (resource IDs, suggestions, agents)
3. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    COHORT_BASIC_RESOURCES,
    COHORT_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_simulation_positions,
    compute_show_simulations,
    compute_simulation_positions_required,
    compute_simulations_required,
    has_access,
)
from app.api.v4.artifacts.cohort.types import (
    CohortDepartment,
    CohortDescriptionResource,
    CohortFlagResource,
    CohortNameResource,
    CohortSimulation,
    GetCohortApiRequest,
    GetCohortApiResponse,
)
from app.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    GetCohortIdsSqlParams,
    GetCohortIdsSqlRow,
)
from app.api.v4.permissions import select_agents_for_artifact, select_multi_resource_agent
from app.api.v4.types import CandidateAgent
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.simulation_positions.get import (
    get_simulation_positions_internal,
)
from app.api.v4.resources.simulations.get import get_simulation_internal
from app.api.v4.resources.simulations.search import search_simulations_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_ids_complete.sql"


router = APIRouter()


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


async def get_cohort_internal(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetCohortApiResponse:
    """Internal function to fetch cohort data using two-pass architecture.

    This is the core logic extracted for reuse by both the HTTP endpoint
    and potential WebSocket generate handlers.

    Args:
        profile_id: The authenticated user's profile ID
        cohort_id: The cohort ID to fetch (None for new cohort mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        GetCohortApiResponse with all cohort data

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """
    from app.main import get_pool

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    async with pool.acquire() as conn:
        query1_params = GetCohortAccessSqlParams(
            profile_id=profile_id,
            cohort_id=cohort_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetCohortAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        cohort_department_ids = access_result.cohort_department_ids or []
        usage_count = access_result.usage_count or 0

        # Early validation: check cohort exists
        if cohort_id is not None:
            if access_result.cohort_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cohort {cohort_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, cohort_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this cohort. It may be restricted to other departments.",
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetCohortIdsSqlParams(
            profile_id=profile_id,
            cohort_id=cohort_id,
            draft_id=draft_id,
            group_id=access_result.group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetCohortIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    descriptions_has_tools = ids_result.descriptions_has_tools or False
    flags_has_tools = ids_result.flags_has_tools or False
    departments_has_tools = ids_result.departments_has_tools or False
    simulations_has_tools = ids_result.simulations_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(COHORT_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=COHORT_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # Extract agent IDs for each resource
    name_agent_id = agent_ids.get("names")
    description_agent_id = agent_ids.get("descriptions")
    flag_agent_id = agent_ids.get("flags")
    departments_agent_id = agent_ids.get("departments")
    simulations_agent_id = agent_ids.get("simulations")

    # Multi-resource agent IDs
    basic_agent_id = select_multi_resource_agent(
        candidate_agents, COHORT_BASIC_RESOURCES, COHORT_RESOURCES, user_dept_set
    )
    general_agent_id = select_multi_resource_agent(
        candidate_agents, COHORT_RESOURCES, COHORT_RESOURCES, user_dept_set
    )

    # === PYTHON BUSINESS LOGIC ===

    # Compute permissions
    can_edit = compute_can_edit(user_role, cohort_department_ids)
    disabled_reason = compute_disabled_reason(user_role, cohort_department_ids)

    # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

    # Selected IDs for fetching
    name_ids = [ids_result.name_id] if ids_result.name_id else []
    description_ids = [ids_result.description_id] if ids_result.description_id else []
    flag_ids = [ids_result.active_flag_id] if ids_result.active_flag_id else []
    department_ids = ids_result.department_ids or []
    simulation_ids = ids_result.simulation_ids or []

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
                None,
                20,
                0,
                access_result.group_id,
                "recent",
                description_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    # Cohort-specific flag names (business logic)
    COHORT_FLAG_NAMES = {"cohort_active"}

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
                artifact_type="cohort",
            )
            # Filter to only cohort-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.name in COHORT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            # Use "all" to show all available departments the user has access to
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

    async def fetch_simulations():
        async with pool.acquire() as c:
            # Fetch each selected simulation
            selected = []
            for sim_id in simulation_ids:
                sim = await get_simulation_internal(c, sim_id, bypass_cache=bypass_cache)
                if sim:
                    selected.append(sim)
            # Search for suggestions
            suggestions = await search_simulations_internal(
                c,
                None,
                20,
                0,
                access_result.group_id,
                "recent",
                simulation_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_simulation_positions():
        async with pool.acquire() as c:
            return await get_simulation_positions_internal(
                c, simulation_ids, bypass_cache=bypass_cache
            )

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (simulations_selected, simulations_suggestions),
        simulation_positions,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_simulations(),
        fetch_simulation_positions(),
    )

    # Dedupe and combine selected + suggestions
    names_raw = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions_raw = _dedupe_by_id(
        descriptions_selected + descriptions_suggestions, "id"
    )
    flags_raw = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments_raw = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    simulations_raw = _dedupe_by_id(
        simulations_selected + simulations_suggestions, "simulation_id"
    )

    # Convert to response types
    names = [
        CohortNameResource(id=n.id, name=n.name, generated=n.generated)
        for n in names_raw
    ]
    descriptions = [
        CohortDescriptionResource(
            id=d.id, description=d.description, generated=d.generated
        )
        for d in descriptions_raw
    ]
    departments = [
        CohortDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in departments_raw
    ]
    simulations = [
        CohortSimulation(
            simulation_id=s.simulation_id,
            name=s.name,
            description=s.description,
            time_limit=s.time_limit,
            generated=s.generated,
        )
        for s in simulations_raw
    ]

    # Convert flags to CohortFlagResource format
    flags = [
        CohortFlagResource(
            id=f.id,
            name=f.name,
            description=f.description,
            icon=f.icon,
            generated=f.generated,
        )
        for f in flags_raw
        if f.id
    ]

    # Find selected resources
    name_resource = next((n for n in names if n.id == ids_result.name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == ids_result.description_id),
        None,
    )
    flag_resource = next(
        (f for f in flags if f.id == ids_result.active_flag_id), None
    )

    # Selected multi-select resources
    department_resources = [
        d for d in departments if d.department_id in department_ids
    ]
    simulation_resources = [
        s for s in simulations if s.simulation_id in simulation_ids
    ]

    # Suggestion IDs
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    simulation_suggestions_ids = [s.simulation_id for s in simulations_suggestions]

    # Compute final show flags based on actual data
    show_name = compute_show_name()
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_simulations_flag = compute_show_simulations(len(simulations))
    show_simulation_positions_flag = compute_show_simulation_positions(
        len(simulation_positions or [])
    )

    # Convert flags to CohortFlagResource format
    # Validation for new mode
    if cohort_id is None:
        # New mode: check for valid departments
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # === Construct Response ===
    return GetCohortApiResponse(
        # Required fields
        actor_name=access_result.actor_name,
        cohort_exists=access_result.cohort_exists,
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
        name_suggestions=name_suggestions_ids,
        names=names,
        # Description
        description_id=ids_result.description_id,
        description_resource=description_resource,
        show_description=show_description_flag,
        description_agent_id=description_agent_id,  # Python-computed
        description_required=compute_description_required(),
        description_suggestions=description_suggestions_ids,
        descriptions=descriptions,
        # Flag
        active_flag_id=ids_result.active_flag_id,
        flag_resource=flag_resource,
        show_flag=show_flag,
        flag_agent_id=flag_agent_id,  # Python-computed
        flag_required=compute_flag_required(),
        flags=flags,
        # Departments
        department_ids=ids_result.department_ids,
        department_resources=department_resources,
        show_departments=show_departments_flag,
        departments_agent_id=departments_agent_id,  # Python-computed
        departments_required=compute_departments_required(show_departments_flag),
        department_suggestions=department_suggestions_ids,
        departments=departments,
        # Simulations
        simulation_ids=ids_result.simulation_ids,
        simulation_resources=simulation_resources,
        show_simulations=show_simulations_flag,
        simulations_agent_id=simulations_agent_id,  # Python-computed
        simulations_required=compute_simulations_required(),
        simulation_suggestions=simulation_suggestions_ids,
        simulations=simulations,
        # Simulation positions
        simulation_positions=simulation_positions or [],
        show_simulation_positions=show_simulation_positions_flag,
        simulation_positions_agent_id=None,  # No separate agent for positions
        simulation_positions_required=compute_simulation_positions_required(),
        # Multi-resource agent IDs (Python-computed)
        basic_agent_id=basic_agent_id,
        general_agent_id=general_agent_id,
    )


def get_cohort_websocket(result: GetCohortApiResponse) -> dict[str, Any]:
    """Websocket wrapper layer for cohort generation context."""
    payload = result.model_dump()
    context_keys = (
        "group_id",
        "name_agent_id",
        "description_agent_id",
        "flag_agent_id",
        "departments_agent_id",
        "simulations_agent_id",
        "simulation_positions_agent_id",
        "basic_agent_id",
        "general_agent_id",
    )
    return {key: payload.get(key) for key in context_keys if payload.get(key) is not None}


def get_cohort_client(result: GetCohortApiResponse) -> GetCohortApiResponse:
    """Client/BFF wrapper layer for cohort get response."""
    payload = result.model_dump()
    if "generation_context" in payload:
        payload["generation_context"] = get_cohort_websocket(result)
    return GetCohortApiResponse.model_validate(payload)


@router.post(
    "/get",
    response_model=GetCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.get",
            "{{ actor.name }} {% if cohort %}viewed{% else %}opened new{% endif %} cohort{% if cohort %} '{{ cohort.name }}'{% endif %}",
        )
    ],
)
async def get_cohort(
    request: GetCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortApiResponse:
    """Get cohort information using two-pass architecture.

    This is a thin HTTP wrapper around get_cohort_internal().

    Query 1: Access check (user role, departments, cohort state)
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
        internal_data = await get_cohort_internal(
            profile_id=profile_id,
            cohort_id=request.cohort_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )
        response_data = get_cohort_client(internal_data)

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            if (
                request.cohort_id
                and response_data.name_resource
                and response_data.name_resource.name
            ):
                audit_ctx["cohort"] = {
                    "name": response_data.name_resource.name,
                    "id": str(request.cohort_id),
                }
            audit_set(http_request, **audit_ctx)

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "cohorts"
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
            operation="get_cohort",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Cohort get endpoint - Two-pass architecture with three-layer BFF.

This implements the refactored approach matching the persona gold standard:
1. Query 1: Access check (user context, cohort state)
2. Query 2: ID fetching (resource IDs, suggestions, agents, domain IDs, tool IDs)
3. Pass 2: Parallel resource fetching (per-resource caching)

Three output layers:
- get_cohort_internal() -> CohortInternalData (shared dataclass)
- get_cohort_websocket() -> GetCohortWebsocketResponse (minimal, for AI generation)
- get_cohort_client() -> GetCohortApiResponse (full BFF response for HTTP/frontend)
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    COHORT_BASIC_RESOURCES,
    COHORT_RESOURCES,
    build_domain_data,
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
    CohortResourceBucket,
    CohortResources,
    CohortSimulation,
    CohortSimulationPosition,
    GetCohortApiRequest,
    GetCohortApiResponse,
    GetCohortWebsocketResponse,
)
from app.api.v4.permissions import (
    select_agents_for_artifact,
    select_multi_resource_agent,
)
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
from app.api.v4.types import CandidateAgent, DomainAgent
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    GetCohortIdsSqlParams,
    GetCohortIdsSqlRow,
    load_sql_query,
)
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


@dataclass
class CohortInternalData:
    """Internal data from core cohort fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_cohort_websocket() - minimal data for WebSocket handlers
    - get_cohort_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    cohort_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Domain mappings
    domain_ids_map: dict[str, UUID | None]
    agent_ids: dict[str, UUID | None]
    domains_list: list[DomainAgent]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: domain_id exists AND agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    simulations_step_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]

    # Resources payload
    resources_payload: CohortResources

    # Per-resource group IDs
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Raw data for backward-compat fields in API response
    name_id: UUID | None
    description_id: UUID | None
    active_flag_id: UUID | None
    department_ids: list[UUID]
    simulation_ids: list[UUID]

    # Selected resources for API response
    name_resource: CohortNameResource | None
    description_resource: CohortDescriptionResource | None
    flag_resource: CohortFlagResource | None
    department_resources: list[CohortDepartment]
    simulation_resources: list[CohortSimulation]
    simulation_positions: list[CohortSimulationPosition]

    # Multi-resource agent IDs (legacy)
    basic_agent_id: UUID | None
    general_agent_id: UUID | None


async def get_cohort_internal(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> CohortInternalData:
    """Core data fetching layer (cacheable).

    Fetches all cohort data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_cohort_websocket() - minimal data for WebSocket handlers
    - get_cohort_client() - full BFF response for HTTP/frontend

    Args:
        profile_id: The authenticated user's profile ID
        cohort_id: The cohort ID to fetch (None for new cohort mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        CohortInternalData with all computed values

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """

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

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in COHORT_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

    # === EXTRACT DOMAIN IDS FROM QUERY 2 ===
    domain_ids_map: dict[str, UUID | None] = {
        "names": ids_result.names_domain_id,
        "descriptions": ids_result.descriptions_domain_id,
        "flags": ids_result.flags_domain_id,
        "departments": ids_result.departments_domain_id,
        "simulations": ids_result.simulations_domain_id,
        "simulation_positions": ids_result.simulation_positions_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        """Returns True if domain_id exists AND agent exists for that resource."""
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    simulations_show_ai_generate = compute_show_ai_generate("simulations")
    simulation_positions_show_ai_generate = compute_show_ai_generate(
        "simulation_positions"
    )

    # Step-level flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    simulations_step_show_ai_generate = any(
        [
            simulations_show_ai_generate,
            simulation_positions_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===

    # Compute permissions
    can_edit = compute_can_edit(user_role, cohort_department_ids)
    disabled_reason = compute_disabled_reason(user_role, cohort_department_ids)

    # Multi-resource agent IDs (legacy)
    basic_agent_id = select_multi_resource_agent(
        candidate_agents, COHORT_BASIC_RESOURCES, COHORT_RESOURCES, user_dept_set
    )
    general_agent_id = select_multi_resource_agent(
        candidate_agents, COHORT_RESOURCES, COHORT_RESOURCES, user_dept_set
    )

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
                sim = await get_simulation_internal(
                    c, sim_id, bypass_cache=bypass_cache
                )
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
    flag_resource = next((f for f in flags if f.id == ids_result.active_flag_id), None)

    # Selected multi-select resources
    department_resources = [d for d in departments if d.department_id in department_ids]
    simulation_resources = [s for s in simulations if s.simulation_id in simulation_ids]

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

    # Validation for new mode
    if cohort_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Build show/required flags maps
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "simulations": show_simulations_flag,
        "simulation_positions": show_simulation_positions_flag,
    }
    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "simulations": compute_simulations_required(),
        "simulation_positions": compute_simulation_positions_required(),
    }

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "simulations": simulations_show_ai_generate,
        "simulation_positions": simulation_positions_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "departments": department_suggestions_ids,
        "simulations": simulation_suggestions_ids,
    }

    # Build domain data for modals
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    # Build resources payload
    resources_payload = CohortResources(
        resources=CohortResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=flags,
            departments=departments,
            simulations=simulations,
            simulation_positions=simulation_positions or [],
        ),
        current=CohortResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            simulations=simulation_resources or [],
            simulation_positions=simulation_positions or [],
        ),
    )

    # Per-resource group IDs (cohort uses single group_id for all resources)
    effective_group_id = access_result.group_id
    resource_group_ids: dict[str, UUID | None] = {
        "names": effective_group_id,
        "descriptions": effective_group_id,
        "flags": effective_group_id,
        "departments": effective_group_id,
        "simulations": effective_group_id,
        "simulation_positions": effective_group_id,
    }

    # Build domains list for WebSocket handler
    domains_list: list[DomainAgent] = []
    for resource, domain_id in domain_ids_map.items():
        if domain_id is not None:
            domains_list.append(
                DomainAgent(
                    domain_id=domain_id,
                    agent_id=agent_ids.get(resource),
                    group_id=resource_group_ids.get(resource),
                )
            )

    return CohortInternalData(
        # Access/context
        actor_name=access_result.actor_name,
        cohort_exists=access_result.cohort_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=access_result.draft_version,
        group_id=effective_group_id,
        # Domain mappings
        domain_ids_map=domain_ids_map,
        agent_ids=agent_ids,
        domains_list=domains_list,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        simulations_step_show_ai_generate=simulations_step_show_ai_generate,
        # Domain data and resources
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        # Per-resource group IDs
        resource_group_ids=resource_group_ids,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        # Raw IDs
        name_id=ids_result.name_id,
        description_id=ids_result.description_id,
        active_flag_id=ids_result.active_flag_id,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        # Selected resources
        name_resource=name_resource,
        description_resource=description_resource,
        flag_resource=flag_resource,
        department_resources=department_resources,
        simulation_resources=simulation_resources,
        simulation_positions=simulation_positions or [],
        # Multi-resource agent IDs (legacy)
        basic_agent_id=basic_agent_id,
        general_agent_id=general_agent_id,
    )


async def get_cohort_websocket(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetCohortWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """
    data = await get_cohort_internal(
        profile_id=profile_id,
        cohort_id=cohort_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetCohortWebsocketResponse(
        group_id=data.group_id,
        # Domain IDs for domain_to_resource mapping
        names_domain_id=data.domain_ids_map.get("names"),
        descriptions_domain_id=data.domain_ids_map.get("descriptions"),
        flags_domain_id=data.domain_ids_map.get("flags"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        simulations_domain_id=data.domain_ids_map.get("simulations"),
        simulation_positions_domain_id=data.domain_ids_map.get("simulation_positions"),
        # Domains mapping for agent lookup
        domains=data.domains_list,
        # Resources for Jinja context
        resources=data.resources_payload,
    )


async def get_cohort_client(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetCohortApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags. Does NOT include domains
    (agent lookup is server-side only).
    """
    data = await get_cohort_internal(
        profile_id=profile_id,
        cohort_id=cohort_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetCohortApiResponse(
        # Required fields
        actor_name=data.actor_name,
        cohort_exists=data.cohort_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        departments_group_id=data.resource_group_ids.get("departments"),
        simulations_group_id=data.resource_group_ids.get("simulations"),
        simulation_positions_group_id=data.resource_group_ids.get(
            "simulation_positions"
        ),
        # Name
        name_id=data.name_id,
        name_resource=data.name_resource,
        show_name=data.show_flags_map.get("names"),
        name_domain_id=data.domain_ids_map.get("names"),
        name_agent_id=data.agent_ids.get("names"),
        name_required=data.required_flags_map.get("names"),
        name_suggestions=data.suggestions_map.get("names"),
        name_show_ai_generate=data.show_ai_generate_map.get("names"),
        names=data.resources_payload.resources.names
        if data.resources_payload.resources
        else None,
        # Description
        description_id=data.description_id,
        description_resource=data.description_resource,
        show_description=data.show_flags_map.get("descriptions"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        description_agent_id=data.agent_ids.get("descriptions"),
        description_required=data.required_flags_map.get("descriptions"),
        description_suggestions=data.suggestions_map.get("descriptions"),
        description_show_ai_generate=data.show_ai_generate_map.get("descriptions"),
        descriptions=data.resources_payload.resources.descriptions
        if data.resources_payload.resources
        else None,
        # Flag
        active_flag_id=data.active_flag_id,
        flag_resource=data.flag_resource,
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_agent_id=data.agent_ids.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        flags=data.resources_payload.resources.flags
        if data.resources_payload.resources
        else None,
        # Departments
        department_ids=data.department_ids,
        department_resources=data.department_resources,
        show_departments=data.show_flags_map.get("departments"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        departments_agent_id=data.agent_ids.get("departments"),
        departments_required=data.required_flags_map.get("departments"),
        department_suggestions=data.suggestions_map.get("departments"),
        departments_show_ai_generate=data.show_ai_generate_map.get("departments"),
        departments=data.resources_payload.resources.departments
        if data.resources_payload.resources
        else None,
        # Simulations
        simulation_ids=data.simulation_ids,
        simulation_resources=data.simulation_resources,
        show_simulations=data.show_flags_map.get("simulations"),
        simulations_domain_id=data.domain_ids_map.get("simulations"),
        simulations_agent_id=data.agent_ids.get("simulations"),
        simulations_required=data.required_flags_map.get("simulations"),
        simulation_suggestions=data.suggestions_map.get("simulations"),
        simulations_show_ai_generate=data.show_ai_generate_map.get("simulations"),
        simulations=data.resources_payload.resources.simulations
        if data.resources_payload.resources
        else None,
        # Simulation positions
        simulation_positions=data.simulation_positions,
        show_simulation_positions=data.show_flags_map.get("simulation_positions"),
        simulation_positions_domain_id=data.domain_ids_map.get("simulation_positions"),
        simulation_positions_agent_id=None,
        simulation_positions_required=data.required_flags_map.get(
            "simulation_positions"
        ),
        simulation_positions_show_ai_generate=data.show_ai_generate_map.get(
            "simulation_positions"
        ),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        simulations_step_show_ai_generate=data.simulations_step_show_ai_generate,
        # Multi-resource agent IDs (legacy)
        basic_agent_id=data.basic_agent_id,
        general_agent_id=data.general_agent_id,
        # Per-resource CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        simulations_create_tool_id=data.create_tool_ids_map.get("simulations"),
        # Per-resource LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        departments_link_tool_id=data.link_tool_ids_map.get("departments"),
        simulations_link_tool_id=data.link_tool_ids_map.get("simulations"),
        simulation_positions_link_tool_id=data.link_tool_ids_map.get(
            "simulation_positions"
        ),
        # Domain metadata for client display in modals
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
    )


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

    This is a thin HTTP wrapper around get_cohort_client().

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

        # Call the client function (calls internal itself)
        response_data = await get_cohort_client(
            profile_id=profile_id,
            cohort_id=request.cohort_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

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

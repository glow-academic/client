"""Simulation get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_simulation_internal() - Core data fetching (cacheable, returns dataclass)
2. get_simulation_websocket() - Minimal data for WebSocket handlers
3. get_simulation_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    SIMULATION_RESOURCES,
    build_domain_data,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_scenario_flags_required,
    compute_scenario_personas_required,
    compute_scenario_positions_required,
    compute_scenario_rubrics_required,
    compute_scenario_show_flags,
    compute_scenario_time_limits_required,
    compute_scenarios_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_scenario_flags,
    compute_show_scenario_personas,
    compute_show_scenario_positions,
    compute_show_scenario_rubrics,
    compute_show_scenario_time_limits,
    compute_show_scenarios,
    has_access,
)
from app.api.v4.artifacts.simulation.types import (
    DomainAgent,
    GetSimulationAccessSqlParams,
    GetSimulationAccessSqlRow,
    GetSimulationApiRequest,
    GetSimulationApiResponse,
    GetSimulationIdsSqlParams,
    GetSimulationIdsSqlRow,
    GetSimulationWebsocketResponse,
    SimulationDepartment,
    SimulationFlagConfig,
    SimulationResourceBucket,
    SimulationResources,
    SimulationScenario,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_internal
from app.api.v4.resources.scenario_flags.get import get_scenario_flags_internal
from app.api.v4.resources.scenario_flags.search import search_scenario_flags_internal
from app.api.v4.resources.scenario_personas.get import get_scenario_personas_internal
from app.api.v4.resources.scenario_personas.search import (
    search_scenario_personas_internal,
)
from app.api.v4.resources.scenario_positions.get import get_scenario_positions_internal
from app.api.v4.resources.scenario_positions.search import (
    search_scenario_positions_internal,
)
from app.api.v4.resources.scenario_rubrics.get import get_scenario_rubrics_internal
from app.api.v4.resources.scenario_rubrics.search import (
    search_scenario_rubrics_internal,
)
from app.api.v4.resources.scenario_time_limits.get import (
    get_scenario_time_limits_internal,
)
from app.api.v4.resources.scenario_time_limits.search import (
    search_scenario_time_limits_internal,
)
from app.api.v4.resources.scenarios.search import search_scenarios_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_resources_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.sql_helper import execute_sql_typed

# SQL paths for two-pass architecture
QUERY1_SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_ids_complete.sql"

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


def derive_simulation_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'simulation_active' -> ('active', 'Active')."""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("simulation_", "")
    label = key.replace("_", " ").title()
    return (key, label)


@dataclass
class SimulationInternalData:
    """Internal data from core simulation fetching (cacheable layer)."""

    # Access/context
    actor_name: str | None
    simulation_exists: bool | None
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

    # Domain data for modals
    domain_data_list: list[Any]

    # Resources payload
    resources_payload: SimulationResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_simulation_internal(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    scenario_search: str | None = None,
    filter_scenario_ids: list[UUID] | None = None,
) -> SimulationInternalData:
    """Core data fetching layer (cacheable).

    Fetches all simulation data using two-pass architecture and returns
    a dataclass with all computed values.
    """
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Fetch draft if draft_id provided
    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_resources_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        # === QUERY 1: Access Check ===
        query1_params = GetSimulationAccessSqlParams(
            profile_id=profile_id,
            simulation_id=simulation_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetSimulationAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        simulation_department_ids = access_result.simulation_department_ids or []
        cohort_usage_count = access_result.cohort_usage_count or 0

        if simulation_id is not None:
            if access_result.simulation_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {simulation_id} not found",
                )
            if not has_access(
                user_role, user_department_ids, simulation_department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation. It may be restricted to other departments.",
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

        # === QUERY 2: ID Fetching ===
        query2_params = GetSimulationIdsSqlParams(
            profile_id=profile_id,
            simulation_id=simulation_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetSimulationIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # === PARSE CANDIDATE AGENTS AND SELECT BEST AGENTS ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
    user_dept_set = set(user_department_ids) if user_department_ids else None

    resources_needed = list(SIMULATION_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=SIMULATION_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in SIMULATION_RESOURCES:
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
        "names": ids_result.name_domain_id,
        "descriptions": ids_result.description_domain_id,
        "flags": ids_result.flag_domain_id,
        "departments": ids_result.departments_domain_id,
        "scenarios": ids_result.scenarios_domain_id,
        "scenario_flags": ids_result.scenario_flags_domain_id,
        "scenario_personas": ids_result.scenario_personas_domain_id,
        "scenario_positions": ids_result.scenario_positions_domain_id,
        "scenario_rubrics": ids_result.scenario_rubrics_domain_id,
        "scenario_time_limits": ids_result.scenario_time_limits_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    show_ai_generate_map = {
        resource: compute_show_ai_generate(resource)
        for resource in SIMULATION_RESOURCES
    }

    basic_show_ai_generate = any(
        [
            show_ai_generate_map.get("names", False),
            show_ai_generate_map.get("descriptions", False),
            show_ai_generate_map.get("flags", False),
            show_ai_generate_map.get("departments", False),
            show_ai_generate_map.get("scenarios", False),
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        simulation_department_ids=simulation_department_ids,
        cohort_usage_count=cohort_usage_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        simulation_department_ids=simulation_department_ids,
        cohort_usage_count=cohort_usage_count,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [ids_result.name_id] if ids_result.name_id else []
    description_ids = [ids_result.description_id] if ids_result.description_id else []
    flag_ids = ids_result.flag_ids or []
    department_ids = ids_result.department_ids or []
    scenario_ids = ids_result.scenario_ids or []
    effective_scenario_ids = filter_scenario_ids or scenario_ids

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
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
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    SIMULATION_FLAG_NAMES_ORDERED = ["simulation_active", "practice"]

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                search=None,
                limit_count=50,
                offset_count=0,
                exclude_ids=None,
                bypass_cache=bypass_cache,
                artifact_type="simulation",
            )
            flags_by_name = {f.name: f for f in all_flags}
            available = [
                flags_by_name[name]
                for name in SIMULATION_FLAG_NAMES_ORDERED
                if name in flags_by_name
            ]
            return (selected, available)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            dept_source = "all" if simulation_id is None else "recent"
            suggestions = await search_departments_internal(
                c,
                None,
                20,
                0,
                user_department_ids,
                dept_source,
                department_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_scenarios():
        from app.api.v4.resources.scenarios.get import get_scenarios_internal

        async with pool.acquire() as c:
            selected = await get_scenarios_internal(c, scenario_ids, bypass_cache)
            suggestions = await search_scenarios_internal(
                c,
                scenario_search,
                20,
                0,
                user_department_ids,
                "recent",
                scenario_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_scenario_flags():
        async with pool.acquire() as c:
            selected = await get_scenario_flags_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            suggestions = await search_scenario_flags_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_personas():
        async with pool.acquire() as c:
            selected = await get_scenario_personas_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            suggestions = await search_scenario_personas_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_positions():
        async with pool.acquire() as c:
            selected = await get_scenario_positions_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            suggestions = await search_scenario_positions_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_rubrics():
        async with pool.acquire() as c:
            selected = await get_scenario_rubrics_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            suggestions = await search_scenario_rubrics_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_time_limits():
        async with pool.acquire() as c:
            selected = await get_scenario_time_limits_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            suggestions = await search_scenario_time_limits_internal(
                c, simulation_id, effective_scenario_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_rubrics():
        async with pool.acquire() as c:
            return await get_rubrics_internal(c, None, bypass_cache)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_available),
        (departments_selected, departments_suggestions),
        (scenarios_selected, scenarios_suggestions),
        (scenario_flags_selected, scenario_flags_suggestions),
        (scenario_personas_selected, scenario_personas_suggestions),
        (scenario_positions_selected, scenario_positions_suggestions),
        (scenario_rubrics_selected, scenario_rubrics_suggestions),
        (scenario_time_limits_selected, scenario_time_limits_suggestions),
        rubrics,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_scenarios(),
        fetch_scenario_flags(),
        fetch_scenario_personas(),
        fetch_scenario_positions(),
        fetch_scenario_rubrics(),
        fetch_scenario_time_limits(),
        fetch_rubrics(),
    )

    # Combine and dedupe
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    scenarios_combined = _dedupe_by_id(
        scenarios_selected + scenarios_suggestions, "scenario_id"
    )
    scenario_flags = _dedupe_by_id(
        list(scenario_flags_selected) + list(scenario_flags_suggestions), "id"
    )
    scenario_personas = _dedupe_by_id(
        list(scenario_personas_selected) + list(scenario_personas_suggestions),
        "id",
    )
    scenario_positions = _dedupe_by_id(
        list(scenario_positions_selected) + list(scenario_positions_suggestions),
        "id",
    )
    scenario_rubrics = _dedupe_by_id(
        list(scenario_rubrics_selected) + list(scenario_rubrics_suggestions), "id"
    )
    scenario_time_limits = _dedupe_by_id(
        list(scenario_time_limits_selected) + list(scenario_time_limits_suggestions),
        "id",
    )

    # Find selected resources
    name_resource = next((n for n in names if n.id == ids_result.name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == ids_result.description_id), None
    )
    flag_resources = list(flags_selected)
    department_resources = [d for d in departments if d.department_id in department_ids]

    # Convert scenarios to SimulationScenario type with computed show_* flags
    def convert_scenario(s: Any) -> SimulationScenario:
        return SimulationScenario(
            scenario_id=s.scenario_id,
            name=s.name,
            description=s.description,
            generated=s.generated,
            **compute_scenario_show_flags(
                problem_statement_enabled=s.problem_statement_enabled,
                objectives_enabled=s.objectives_enabled,
                video_enabled=s.video_enabled,
                images_enabled=s.images_enabled,
                questions_enabled=s.questions_enabled,
                templates_enabled=s.templates_enabled,
            ),
        )

    scenario_resources_current = [convert_scenario(s) for s in scenarios_selected]
    scenarios_typed = [convert_scenario(s) for s in scenarios_combined]

    # Build flag configs
    show_flag = compute_show_flag()
    simulation_flags = [
        SimulationFlagConfig(
            key=derive_simulation_flag_key_and_label(flag.name)[0],
            label=derive_simulation_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            domain_id=domain_ids_map.get("flags"),
            generated=flag.generated,
        )
        for flag in flags_available
        if flag.id
    ]

    # Suggestion IDs
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    scenario_suggestions_ids = [s.scenario_id for s in scenarios_suggestions]

    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "departments": department_suggestions_ids,
        "scenarios": scenario_suggestions_ids,
    }

    # Convert departments to typed format
    departments_typed = [
        SimulationDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in departments
    ]
    department_resources_typed = [
        SimulationDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in department_resources
    ]

    # Compute show/required flags
    names_has_tools = ids_result.names_has_tools or False
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_departments_flag = compute_show_departments(len(departments))
    show_scenarios_flag = compute_show_scenarios(len(scenarios_combined))

    show_scenario_flags_flag = compute_show_scenario_flags(
        effective_scenario_ids, len(scenario_flags), len(scenarios_combined)
    )
    show_scenario_personas_flag = compute_show_scenario_personas(
        effective_scenario_ids, len(scenario_personas), len(scenarios_combined)
    )
    show_scenario_positions_flag = compute_show_scenario_positions(
        effective_scenario_ids, len(scenario_positions), len(scenarios_combined)
    )
    show_scenario_rubrics_flag = compute_show_scenario_rubrics(
        effective_scenario_ids, len(scenario_rubrics), len(scenarios_combined)
    )
    show_scenario_time_limits_flag = compute_show_scenario_time_limits(
        effective_scenario_ids, len(scenario_time_limits), len(scenarios_combined)
    )

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "scenarios": show_scenarios_flag,
        "scenario_flags": show_scenario_flags_flag,
        "scenario_personas": show_scenario_personas_flag,
        "scenario_positions": show_scenario_positions_flag,
        "scenario_rubrics": show_scenario_rubrics_flag,
        "scenario_time_limits": show_scenario_time_limits_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "scenarios": compute_scenarios_required(),
        "scenario_flags": compute_scenario_flags_required(),
        "scenario_personas": compute_scenario_personas_required(),
        "scenario_positions": compute_scenario_positions_required(),
        "scenario_rubrics": compute_scenario_rubrics_required(),
        "scenario_time_limits": compute_scenario_time_limits_required(),
    }

    # Build domain data for client
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.names_group_id if draft_item else None,
        "descriptions": draft_item.descriptions_group_id if draft_item else None,
        "flags": draft_item.flags_group_id if draft_item else None,
        "departments": draft_item.departments_group_id if draft_item else None,
        "scenarios": draft_item.scenarios_group_id if draft_item else None,
        "scenario_flags": getattr(draft_item, "scenario_flags_group_id", None)
        if draft_item
        else None,
        "scenario_personas": getattr(draft_item, "scenario_personas_group_id", None)
        if draft_item
        else None,
        "scenario_positions": getattr(draft_item, "scenario_positions_group_id", None)
        if draft_item
        else None,
        "scenario_rubrics": getattr(draft_item, "scenario_rubrics_group_id", None)
        if draft_item
        else None,
        "scenario_time_limits": getattr(
            draft_item, "scenario_time_limits_group_id", None
        )
        if draft_item
        else None,
    }

    # Validation for new mode
    if simulation_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Build resources payload (persona-style)
    resources_payload = SimulationResources(
        resources=SimulationResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=simulation_flags,
            departments=departments_typed,
            scenarios=scenarios_typed,
            scenario_flags=scenario_flags,
            scenario_personas=scenario_personas,
            scenario_positions=scenario_positions,
            scenario_rubrics=scenario_rubrics,
            scenario_time_limits=scenario_time_limits,
            rubrics=rubrics,
        ),
        current=SimulationResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=flag_resources or [],
            departments=department_resources_typed or [],
            scenarios=scenario_resources_current or [],
            scenario_flags=list(scenario_flags_selected) or [],
            scenario_personas=list(scenario_personas_selected) or [],
            scenario_positions=list(scenario_positions_selected) or [],
            scenario_rubrics=list(scenario_rubrics_selected) or [],
            scenario_time_limits=list(scenario_time_limits_selected) or [],
        ),
    )

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

    return SimulationInternalData(
        actor_name=access_result.actor_name,
        simulation_exists=access_result.simulation_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        domain_ids_map=domain_ids_map,
        agent_ids=agent_ids,
        domains_list=domains_list,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        resource_group_ids=resource_group_ids,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_simulation_websocket(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSimulationWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """
    data = await get_simulation_internal(
        profile_id=profile_id,
        simulation_id=simulation_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetSimulationWebsocketResponse(
        group_id=data.group_id,
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        scenarios_domain_id=data.domain_ids_map.get("scenarios"),
        scenario_flags_domain_id=data.domain_ids_map.get("scenario_flags"),
        scenario_personas_domain_id=data.domain_ids_map.get("scenario_personas"),
        scenario_positions_domain_id=data.domain_ids_map.get("scenario_positions"),
        scenario_rubrics_domain_id=data.domain_ids_map.get("scenario_rubrics"),
        scenario_time_limits_domain_id=data.domain_ids_map.get("scenario_time_limits"),
        domains=data.domains_list,
        resources=data.resources_payload,
    )


async def get_simulation_client(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    scenario_search: str | None = None,
    filter_scenario_ids: list[UUID] | None = None,
) -> GetSimulationApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_simulation_internal(
        profile_id=profile_id,
        simulation_id=simulation_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        scenario_search=scenario_search,
        filter_scenario_ids=filter_scenario_ids,
    )

    return GetSimulationApiResponse(
        # Required fields
        actor_name=data.actor_name,
        simulation_exists=data.simulation_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        departments_group_id=data.resource_group_ids.get("departments"),
        scenarios_group_id=data.resource_group_ids.get("scenarios"),
        scenario_flags_group_id=data.resource_group_ids.get("scenario_flags"),
        scenario_personas_group_id=data.resource_group_ids.get("scenario_personas"),
        scenario_positions_group_id=data.resource_group_ids.get("scenario_positions"),
        scenario_rubrics_group_id=data.resource_group_ids.get("scenario_rubrics"),
        scenario_time_limits_group_id=data.resource_group_ids.get(
            "scenario_time_limits"
        ),
        # Name
        show_name=data.show_flags_map.get("names"),
        name_domain_id=data.domain_ids_map.get("names"),
        name_required=data.required_flags_map.get("names"),
        name_suggestions=data.suggestions_map.get("names"),
        name_show_ai_generate=data.show_ai_generate_map.get("names"),
        # Description
        show_description=data.show_flags_map.get("descriptions"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        description_required=data.required_flags_map.get("descriptions"),
        description_suggestions=data.suggestions_map.get("descriptions"),
        description_show_ai_generate=data.show_ai_generate_map.get("descriptions"),
        # Flag
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Departments
        show_departments=data.show_flags_map.get("departments"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        departments_required=data.required_flags_map.get("departments"),
        department_suggestions=data.suggestions_map.get("departments"),
        departments_show_ai_generate=data.show_ai_generate_map.get("departments"),
        # Scenarios
        show_scenarios=data.show_flags_map.get("scenarios"),
        scenarios_domain_id=data.domain_ids_map.get("scenarios"),
        scenarios_required=data.required_flags_map.get("scenarios"),
        scenario_suggestions=data.suggestions_map.get("scenarios"),
        scenarios_show_ai_generate=data.show_ai_generate_map.get("scenarios"),
        # Scenario flags
        show_scenario_flags=data.show_flags_map.get("scenario_flags"),
        scenario_flags_domain_id=data.domain_ids_map.get("scenario_flags"),
        scenario_flags_required=data.required_flags_map.get("scenario_flags"),
        scenario_flags_show_ai_generate=data.show_ai_generate_map.get("scenario_flags"),
        # Scenario personas
        show_scenario_personas=data.show_flags_map.get("scenario_personas"),
        scenario_personas_domain_id=data.domain_ids_map.get("scenario_personas"),
        scenario_personas_required=data.required_flags_map.get("scenario_personas"),
        scenario_personas_show_ai_generate=data.show_ai_generate_map.get(
            "scenario_personas"
        ),
        # Scenario positions
        show_scenario_positions=data.show_flags_map.get("scenario_positions"),
        scenario_positions_domain_id=data.domain_ids_map.get("scenario_positions"),
        scenario_positions_required=data.required_flags_map.get("scenario_positions"),
        scenario_positions_show_ai_generate=data.show_ai_generate_map.get(
            "scenario_positions"
        ),
        # Scenario rubrics
        show_scenario_rubrics=data.show_flags_map.get("scenario_rubrics"),
        scenario_rubrics_domain_id=data.domain_ids_map.get("scenario_rubrics"),
        scenario_rubrics_required=data.required_flags_map.get("scenario_rubrics"),
        scenario_rubrics_show_ai_generate=data.show_ai_generate_map.get(
            "scenario_rubrics"
        ),
        # Scenario time limits
        show_scenario_time_limits=data.show_flags_map.get("scenario_time_limits"),
        scenario_time_limits_domain_id=data.domain_ids_map.get("scenario_time_limits"),
        scenario_time_limits_required=data.required_flags_map.get(
            "scenario_time_limits"
        ),
        scenario_time_limits_show_ai_generate=data.show_ai_generate_map.get(
            "scenario_time_limits"
        ),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        # Per-resource CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        scenarios_create_tool_id=data.create_tool_ids_map.get("scenarios"),
        # Per-resource LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        departments_link_tool_id=data.link_tool_ids_map.get("departments"),
        scenarios_link_tool_id=data.link_tool_ids_map.get("scenarios"),
        scenario_flags_link_tool_id=data.link_tool_ids_map.get("scenario_flags"),
        scenario_personas_link_tool_id=data.link_tool_ids_map.get("scenario_personas"),
        scenario_positions_link_tool_id=data.link_tool_ids_map.get(
            "scenario_positions"
        ),
        scenario_rubrics_link_tool_id=data.link_tool_ids_map.get("scenario_rubrics"),
        scenario_time_limits_link_tool_id=data.link_tool_ids_map.get(
            "scenario_time_limits"
        ),
        # Domain metadata
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
    )


@router.post(
    "/get",
    response_model=GetSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.get",
            "{{ actor.name }} {% if simulation %}viewed{% else %}opened new{% endif %} simulation{% if simulation %} '{{ simulation.name }}'{% endif %}",
        )
    ],
)
async def get_simulation(
    request: GetSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationApiResponse:
    """Get simulation information using two-pass architecture.

    This is a thin HTTP wrapper around get_simulation_client().
    """
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_simulation_client(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            scenario_search=request.scenario_search,
            filter_scenario_ids=request.filter_scenario_ids,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            current_resources = (
                response_data.resources.current if response_data.resources else None
            )
            if current_resources and current_resources.names:
                name_item = current_resources.names[0]
                current_name = (
                    name_item.get("name")
                    if isinstance(name_item, dict)
                    else getattr(name_item, "name", None)
                )
            if request.simulation_id and current_name:
                audit_ctx["simulation"] = {
                    "name": current_name,
                    "id": str(request.simulation_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "simulations"
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
            operation="get_simulation",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Simulation get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Query 1: Access check (user context, simulation state)
2. Query 2: ID fetching (resource IDs, agents metadata)
3. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_scenario_show_flags,
    compute_scenarios_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_scenarios,
    has_access,
)
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_internal
from app.api.v4.resources.scenario_flags.get import get_scenario_flags_internal
from app.api.v4.resources.scenario_flags.search import search_scenario_flags_internal
from app.api.v4.resources.scenario_positions.get import get_scenario_positions_internal
from app.api.v4.resources.scenario_positions.search import (
    search_scenario_positions_internal,
)
from app.api.v4.resources.scenario_rubrics.get import get_scenario_rubrics_internal
from app.api.v4.resources.scenario_rubrics.search import search_scenario_rubrics_internal
from app.api.v4.resources.scenario_time_limits.get import get_scenario_time_limits_internal
from app.api.v4.resources.scenario_time_limits.search import (
    search_scenario_time_limits_internal,
)
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.scenarios.search import search_scenarios_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.api.v4.artifacts.simulation.types import (
    GetSimulationAccessSqlParams,
    GetSimulationAccessSqlRow,
    GetSimulationApiRequest,
    GetSimulationApiResponse,
    GetSimulationIdsSqlParams,
    GetSimulationIdsSqlRow,
    SimulationDepartment,
    SimulationFlagConfig,
    SimulationScenario,
)
from app.api.v4.resources.flags.search import search_flags_internal
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

    Query 1: Access check (user role, departments, simulation state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query = load_sql_query(QUERY1_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Access Check (always fresh, no cache) ===
        query1_params = GetSimulationAccessSqlParams(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
            draft_id=request.draft_id,
        )
        sql_params = query1_params.to_tuple()

        access_result = cast(
            GetSimulationAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        simulation_department_ids = access_result.simulation_department_ids or []
        cohort_usage_count = access_result.cohort_usage_count or 0

        # Early validation: check simulation exists
        if request.simulation_id is not None:
            if access_result.simulation_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {request.simulation_id} not found",
                )

            # Check access
            if not has_access(
                user_role, user_department_ids, simulation_department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation. It may be restricted to other departments.",
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetSimulationIdsSqlParams(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
            draft_id=request.draft_id,
            group_id=access_result.group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetSimulationIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

        # === PYTHON BUSINESS LOGIC ===

        # Compute permissions
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

        # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

        # Selected IDs for fetching
        name_ids = [ids_result.name_id] if ids_result.name_id else []
        description_ids = (
            [ids_result.description_id] if ids_result.description_id else []
        )
        flag_ids = ids_result.flag_ids or []
        department_ids = ids_result.department_ids or []
        scenario_ids = ids_result.scenario_ids or []

        # For scenario-dependent resources (flags, positions, rubrics, time_limits),
        # use filter_scenario_ids if provided (current UI selection), otherwise use saved scenario_ids
        effective_scenario_ids = request.filter_scenario_ids or scenario_ids

        # Get pool for parallel connections
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

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
                selected = await get_descriptions_internal(
                    c, description_ids, bypass_cache
                )
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

        # Simulation-specific flag names (business logic)
        SIMULATION_FLAG_NAMES = {"simulation_active", "practice"}

        async def fetch_flags():
            async with pool.acquire() as c:
                # Get selected flags
                selected = await get_flags_internal(c, flag_ids, bypass_cache)
                # Search for all available simulation flags (by type)
                all_flags = await search_flags_internal(
                    c,
                    search=None,
                    limit_count=50,
                    offset_count=0,
                    exclude_ids=None,
                    bypass_cache=bypass_cache,
                    artifact_type="simulation",
                )
                # Filter to only simulation-specific flags (business logic in Python)
                available = [f for f in all_flags if f.name in SIMULATION_FLAG_NAMES]
                return (selected, available)

        async def fetch_departments():
            async with pool.acquire() as c:
                selected = await get_departments_internal(
                    c, department_ids, bypass_cache
                )
                dept_source = "all" if request.simulation_id is None else "recent"
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
            async with pool.acquire() as c:
                selected = await get_scenarios_internal(c, scenario_ids, bypass_cache)
                suggestions = await search_scenarios_internal(
                    c,
                    request.scenario_search,
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
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                suggestions = await search_scenario_flags_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                return (selected, suggestions)

        async def fetch_scenario_positions():
            async with pool.acquire() as c:
                selected = await get_scenario_positions_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                suggestions = await search_scenario_positions_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                return (selected, suggestions)

        async def fetch_scenario_rubrics():
            async with pool.acquire() as c:
                selected = await get_scenario_rubrics_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                suggestions = await search_scenario_rubrics_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                return (selected, suggestions)

        async def fetch_scenario_time_limits():
            async with pool.acquire() as c:
                selected = await get_scenario_time_limits_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                suggestions = await search_scenario_time_limits_internal(
                    c, request.simulation_id, effective_scenario_ids, bypass_cache
                )
                return (selected, suggestions)

        async def fetch_rubrics():
            async with pool.acquire() as c:
                return await get_rubrics_internal(
                    c, request.simulation_id, bypass_cache
                )

        # Parallel fetch all resources
        (
            (names_selected, names_suggestions),
            (descriptions_selected, descriptions_suggestions),
            (flags_selected, flags_available),
            (departments_selected, departments_suggestions),
            (scenarios_selected, scenarios_suggestions),
            (scenario_flags_selected, scenario_flags_suggestions),
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
            fetch_scenario_positions(),
            fetch_scenario_rubrics(),
            fetch_scenario_time_limits(),
            fetch_rubrics(),
        )

        # Combine scenario junction resources
        scenario_flags = _dedupe_by_id(
            list(scenario_flags_selected) + list(scenario_flags_suggestions), "id"
        )
        scenario_positions = _dedupe_by_id(
            list(scenario_positions_selected) + list(scenario_positions_suggestions),
            "id",
        )
        scenario_rubrics = _dedupe_by_id(
            list(scenario_rubrics_selected) + list(scenario_rubrics_suggestions), "id"
        )
        scenario_time_limits = _dedupe_by_id(
            list(scenario_time_limits_selected)
            + list(scenario_time_limits_suggestions),
            "id",
        )

        # Combine selected and suggestions (dedupe)
        names = _dedupe_by_id(names_selected + names_suggestions, "id")
        descriptions = _dedupe_by_id(
            descriptions_selected + descriptions_suggestions, "id"
        )
        departments = _dedupe_by_id(
            departments_selected + departments_suggestions, "department_id"
        )
        scenarios = _dedupe_by_id(
            scenarios_selected + scenarios_suggestions, "scenario_id"
        )

        # Find selected resources
        name_resource = next((n for n in names if n.id == ids_result.name_id), None)
        description_resource = next(
            (d for d in descriptions if d.id == ids_result.description_id), None
        )

        # Build flag resources from selected flags
        flag_resources = list(flags_selected)

        # Helper function to derive key and label from flag name
        def derive_simulation_flag_key_and_label(name: str | None) -> tuple[str, str]:
            """Derive key and label from flag name."""
            if not name:
                return ("unknown", "Unknown")
            # 'simulation_active' -> 'active', 'practice' stays 'practice'
            key = name.replace("simulation_", "")
            label = key.replace("_", " ").title()
            return (key, label)

        # Build flags array from available flags for the UI
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
                agent_id=ids_result.flag_agent_id,
                generated=flag.generated,
            )
            for flag in flags_available
            if flag.id
        ]

        # Selected multi-select resources
        department_resources = [
            d for d in departments if d.department_id in department_ids
        ]
        # Convert scenarios to SimulationScenario type with computed show_* flags
        scenario_resources = [
            SimulationScenario(
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
            for s in scenarios_selected
        ]

        # Suggestion IDs
        name_suggestions_ids = [n.id for n in names_suggestions]
        description_suggestions_ids = [d.id for d in descriptions_suggestions]
        department_suggestions_ids = [d.department_id for d in departments_suggestions]
        scenario_suggestions_ids = [s.scenario_id for s in scenarios_suggestions]

        # Convert departments to expected type (simplified - no relationship arrays)
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

        # Convert scenarios to expected type with computed show_* flags
        scenarios_typed = [
            SimulationScenario(
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
            for s in scenarios
        ]

        # Compute final show flags based on actual data
        names_has_tools = ids_result.names_has_tools or False
        show_name = compute_show_name(names_has_tools)
        show_description = compute_show_description()
        show_departments = compute_show_departments(len(departments))
        show_flag = compute_show_flag()
        show_scenarios = compute_show_scenarios(len(scenarios))

        # Show scenario-related fields when scenarios exist or are available
        show_scenario_flags = bool(effective_scenario_ids or scenario_flags or scenarios)
        show_scenario_positions = bool(effective_scenario_ids or scenario_positions or scenarios)
        show_scenario_rubrics = bool(effective_scenario_ids or scenario_rubrics or scenarios)
        show_scenario_time_limits = bool(effective_scenario_ids or scenario_time_limits or scenarios)

        # Set audit context
        if access_result.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": access_result.actor_name, "id": profile_id}
            }
            if request.simulation_id and name_resource and name_resource.name:
                audit_ctx["simulation"] = {
                    "name": name_resource.name,
                    "id": str(request.simulation_id),
                }
            audit_set(http_request, **audit_ctx)

        # Validation for new mode
        if request.simulation_id is None:
            if not departments:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )

        # Helper to convert to dict
        def _to_dict(item: Any) -> dict[str, Any]:
            if hasattr(item, "model_dump"):
                return item.model_dump()
            return dict(item)

        # === Construct Response ===
        response_data = GetSimulationApiResponse(
            # Required fields
            actor_name=access_result.actor_name,
            simulation_exists=access_result.simulation_exists,
            can_edit=can_edit,
            disabled_reason=disabled_reason,
            group_id=access_result.group_id,
            draft_version=access_result.draft_version,
            # Name
            name_id=ids_result.name_id,
            name_resource=_to_dict(name_resource) if name_resource else None,
            show_name=show_name,
            name_agent_id=ids_result.name_agent_id,
            name_required=compute_name_required(),
            name_suggestions=name_suggestions_ids,
            names=[_to_dict(n) for n in names],
            # Description
            description_id=ids_result.description_id,
            description_resource=_to_dict(description_resource)
            if description_resource
            else None,
            show_description=show_description,
            description_agent_id=ids_result.description_agent_id,
            description_required=compute_description_required(),
            description_suggestions=description_suggestions_ids,
            descriptions=[_to_dict(d) for d in descriptions],
            # Flags (multi-select like departments)
            flag_ids=flag_ids,
            flag_resources=[_to_dict(f) for f in flag_resources],
            show_flags=show_flag,
            flag_agent_id=ids_result.flag_agent_id,
            flag_required=compute_flag_required(),
            flags=[f.model_dump() for f in simulation_flags],
            # Departments
            department_ids=department_ids,
            department_resources=[_to_dict(d) for d in department_resources_typed],
            show_departments=show_departments,
            departments_agent_id=ids_result.departments_agent_id,
            departments_required=compute_departments_required(),
            department_suggestions=department_suggestions_ids,
            departments=[_to_dict(d) for d in departments_typed],
            # Scenarios
            scenario_ids=scenario_ids,
            scenario_resources=[_to_dict(s) for s in scenario_resources],
            show_scenarios=show_scenarios,
            scenarios_agent_id=ids_result.scenarios_agent_id,
            scenarios_required=compute_scenarios_required(),
            scenario_suggestions=scenario_suggestions_ids,
            scenarios=[_to_dict(s) for s in scenarios_typed],
            # Scenario flags
            scenario_flag_ids=ids_result.scenario_flag_ids or [],
            scenario_flag_resources=[_to_dict(sf) for sf in scenario_flags],
            show_scenario_flags=show_scenario_flags,
            scenario_flags_agent_id=None,
            scenario_flags_required=False,
            scenario_flag_suggestions=[],
            scenario_flags=[_to_dict(sf) for sf in scenario_flags],
            # Scenario positions
            scenario_position_ids=ids_result.scenario_position_ids or [],
            scenario_position_resources=[_to_dict(sp) for sp in scenario_positions],
            show_scenario_positions=show_scenario_positions,
            scenario_positions_agent_id=None,
            scenario_positions_required=False,
            scenario_position_suggestions=[],
            scenario_positions=[_to_dict(sp) for sp in scenario_positions],
            # Scenario rubrics
            scenario_rubric_ids=ids_result.scenario_rubric_ids or [],
            scenario_rubric_resources=[_to_dict(sr) for sr in scenario_rubrics],
            show_scenario_rubrics=show_scenario_rubrics,
            scenario_rubrics_agent_id=None,
            scenario_rubrics_required=True,
            scenario_rubric_suggestions=[],
            scenario_rubrics=[_to_dict(sr) for sr in scenario_rubrics],
            rubrics=[_to_dict(r) for r in rubrics],
            # Scenario time limits
            scenario_time_limit_ids=ids_result.scenario_time_limit_ids or [],
            scenario_time_limit_resources=[
                _to_dict(stl) for stl in scenario_time_limits
            ],
            show_scenario_time_limits=show_scenario_time_limits,
            scenario_time_limits_agent_id=None,
            scenario_time_limits_required=False,
            scenario_time_limit_suggestions=[],
            scenario_time_limits=[_to_dict(stl) for stl in scenario_time_limits],
            # General agent ID
            general_agent_id=ids_result.general_agent_id,
        )

        # No global cache for this response - individual resources are cached
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
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

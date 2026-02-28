"""Simulations list endpoint - v4 API following DHH principles.

Permissions (can_edit, can_delete, can_duplicate) computed in Python.
Scenario/persona mapping hydrated in Python via cached *_internal() functions.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.simulation.types import (
    ListSimulationApiPersona,
    ListSimulationApiResponse,
    ListSimulationApiScenario,
    ListSimulationApiSimulation,
    ListSimulationSqlRow,
    QGetScenariosV4Item,
)
from app.api.v4.types import ListFilterSection
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetSimulationsListApiRequest,
    GetSimulationsListSqlParams,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SIMULATION_IMPORT_FIELDS: list[dict] = [
    {
        "key": "name",
        "label": "Name",
        "required": True,
        "example": "Clinical Assessment",
        "description": "The simulation's display name",
    },
    {
        "key": "description",
        "label": "Description",
        "example": "A clinical assessment simulation...",
        "description": "Optional description",
    },
    {
        "key": "is_inactive",
        "label": "Inactive",
        "type": "boolean",
        "example": "false",
        "description": "Whether the simulation is inactive (true/false)",
    },
    {
        "key": "is_practice",
        "label": "Practice",
        "type": "boolean",
        "example": "false",
        "description": "Whether the simulation is a practice simulation (true/false)",
    },
    {
        "key": "departments",
        "label": "Departments",
        "multi": True,
        "example": "Nursing, Medicine",
        "description": "Comma-separated department names",
    },
    {
        "key": "scenarios",
        "label": "Scenarios",
        "multi": True,
        "example": "Emergency Triage, Patient Intake",
        "description": "Comma-separated scenario names",
    },
]

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/simulations/get_simulations_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulations.list", "{{ actor.name }} visited the Simulations page"
        )
    ],
)
async def get_simulation_list(
    filters: GetSimulationsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListSimulationApiResponse:
    """Get simulations list with SQL-computed permissions."""
    tags = ["simulations"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = filters.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListSimulationApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit logging and permissions (lazy import to avoid circular deps)
        from app.api.v4.auth.profile import get_auth_profile_internal

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = "member"
            user_department_ids = []

        # Convert API request to SQL params
        params = GetSimulationsListSqlParams(
            **filters.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            ListSimulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # --- Python hydration: scenarios + personas from cached *_internal() ---
        # 1. Collect unique scenario_ids from paginated simulations
        scenario_id_set: set[UUID] = set()
        for sim in result.simulations or []:
            for sid in sim.scenario_ids or []:
                try:
                    scenario_id_set.add(UUID(str(sid)))
                except (ValueError, AttributeError):
                    pass

        # 2. Fetch scenarios via cached resource function
        # Deferred import to avoid circular import:
        # resources/scenarios/get → artifacts/simulation/types → __init__ → list → resources/scenarios/get
        from app.api.v4.resources.scenarios.get import get_scenarios_internal

        scenarios_data: list[QGetScenariosV4Item] = []
        if scenario_id_set:
            pool = get_pool()
            if pool:
                async with pool.acquire() as c:
                    scenarios_data = await get_scenarios_internal(
                        c, list(scenario_id_set), bypass_cache
                    )

        # 3. Collect persona_ids from scenario results
        persona_id_set: set[UUID] = set()
        for s in scenarios_data:
            for pid in s.persona_ids or []:
                persona_id_set.add(pid)

        # 4. Fetch personas via cached resource function
        from app.api.v4.resources.personas.get import get_personas_internal

        persona_map: dict[UUID, str] = {}
        if persona_id_set:
            pool = get_pool()
            if pool:
                async with pool.acquire() as c:
                    personas_data = await get_personas_internal(
                        c, list(persona_id_set), bypass_cache
                    )
                    persona_map = {
                        p.persona_id: p.color or ""
                        for p in personas_data
                        if p.persona_id
                    }

        # 5. Assemble scenario mapping with persona colors
        scenario_mapping: list[ListSimulationApiScenario] = []
        for s in scenarios_data:
            p_ids = s.persona_ids or []
            scenario_mapping.append(
                ListSimulationApiScenario(
                    scenario_id=s.scenario_id,
                    name=s.name,
                    persona_ids=[str(pid) for pid in p_ids],
                    persona_mapping=[
                        ListSimulationApiPersona(
                            persona_id=str(pid),
                            color=persona_map.get(pid, ""),
                        )
                        for pid in p_ids
                        if pid in persona_map
                    ],
                )
            )

        # Compute permissions in Python for each simulation
        api_simulations: list[ListSimulationApiSimulation] = []
        for sim in result.simulations or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                simulation_department_ids=sim.department_ids,
                cohort_usage_count=sim.cohort_usage_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                simulation_department_ids=sim.department_ids,
                cohort_usage_count=sim.cohort_usage_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            api_simulations.append(
                ListSimulationApiSimulation(
                    simulation_id=sim.simulation_id,
                    name=sim.name,
                    description=sim.description,
                    department_ids=sim.department_ids,
                    is_inactive=sim.is_inactive,
                    practice_simulation=sim.practice_simulation,
                    generated=getattr(sim, "generated", None),
                    mcp=getattr(sim, "mcp", None),
                    scenario_ids=sim.scenario_ids,
                    num_cohorts=sim.num_cohorts,
                    cohort_usage_count=sim.cohort_usage_count,
                    can_edit=can_edit_val,
                    can_delete=can_delete_val,
                    can_duplicate=can_duplicate_val,
                    cohort_ids=getattr(sim, "cohort_ids", None),
                    updated_at=sim.updated_at,
                )
            )

        # Build API response
        api_response = ListSimulationApiResponse(
            actor_name=actor_name,
            simulations=api_simulations,
            scenarios=scenario_mapping,
            scenario_filter=ListFilterSection.from_sql_options(
                result.scenario_options,
                filters.filter_scenario_ids,
                filters.scenario_search,
            ),
            cohort_filter=ListFilterSection.from_sql_options(
                result.cohort_options,
                filters.filter_cohort_ids,
                filters.cohort_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                filters.filter_department_ids,
                filters.department_search,
            ),
            total_count=result.total_count,
            import_fields=SIMULATION_IMPORT_FIELDS,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

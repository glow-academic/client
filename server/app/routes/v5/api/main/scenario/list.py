"""Scenarios list endpoint - v4 API following DHH principles.

Resource-first: SQL only touches scenario_artifact + scenario's own junctions + resource tables.
Permissions (can_edit, can_delete, can_duplicate) computed in Python.
Mapping arrays (objectives/fields/cohorts/personas/simulations/departments) hydrated in Python
via cached *_internal() functions.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.persona.types import ImportField
from app.routes.v5.api.main.scenario.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.scenario.types import (
    GetScenariosListApiRequest,
    GetScenariosListSqlParams,
    ListScenarioApiCohort,
    ListScenarioApiDepartment,
    ListScenarioApiField,
    ListScenarioApiObjective,
    ListScenarioApiPersona,
    ListScenarioApiResponse,
    ListScenarioApiScenario,
    ListScenarioApiSimulation,
    ListScenarioSqlRow,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.resources.cohorts.get import get_cohorts_internal
from app.routes.v5.api.resources.departments.get import get_departments_internal
from app.routes.v5.api.resources.fields.get import get_fields_internal
from app.routes.v5.api.resources.objectives.get import get_objectives_internal
from app.routes.v5.api.resources.personas.get import get_personas_internal
from app.routes.v5.api.resources.simulations.get import get_simulations_internal
from app.routes.v5.api.types import ListFilterSection
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/scenario/get_scenarios_list_complete.sql"

SCENARIO_IMPORT_FIELDS: list[ImportField] = [
    ImportField(
        key="name",
        label="Name",
        required=True,
        example="Emergency Triage",
        description="The scenario's display name",
    ),
    ImportField(
        key="description",
        label="Description",
        example="A triage scenario...",
        description="Optional description",
    ),
    ImportField(
        key="problem_statement",
        label="Problem Statement",
        example="A patient arrives...",
        description="The scenario problem statement",
    ),
    ImportField(
        key="active_flag",
        label="Active",
        type="boolean",
        example="true",
        description="Whether the scenario is active (true/false)",
    ),
    ImportField(
        key="departments",
        label="Departments",
        multi=True,
        example="Nursing, Medicine",
        description="Comma-separated department names",
    ),
    ImportField(
        key="personas",
        label="Personas",
        multi=True,
        example="Sarah the Nurse",
        description="Comma-separated persona names",
    ),
    ImportField(
        key="documents",
        label="Documents",
        multi=True,
        example="Protocol Guide",
        description="Comma-separated document names",
    ),
    ImportField(
        key="parameter_fields",
        label="Parameter Fields",
        multi=True,
        example="Patient Age, Condition",
        description="Comma-separated parameter field names",
    ),
    ImportField(
        key="objectives",
        label="Objectives",
        multi=True,
        example="Assess patient",
        description="Comma-separated objective texts",
    ),
    ImportField(
        key="images",
        label="Images",
        multi=True,
        example="X-Ray Image",
        description="Comma-separated image names",
    ),
    ImportField(
        key="videos",
        label="Videos",
        multi=True,
        example="Training Video",
        description="Comma-separated video names",
    ),
    ImportField(
        key="questions",
        label="Questions",
        multi=True,
        example="What is the diagnosis?",
        description="Comma-separated question texts",
    ),
    ImportField(
        key="options",
        label="Options",
        multi=True,
        example="Option A, Option B",
        description="Comma-separated option texts",
    ),
]

router = APIRouter()


@router.post("/list", response_model=ListScenarioApiResponse)
async def get_scenario_list(
    request: GetScenariosListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListScenarioApiResponse:
    """Get scenarios list with all relationships."""
    tags = ["scenarios"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListScenarioApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetScenariosListSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            ListScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # --- Python hydration: 6-way parallel fetch from cached *_internal() ---
        # 1. Collect unique IDs from paginated scenarios
        persona_id_set: set[UUID] = set()
        simulation_id_set: set[UUID] = set()
        department_id_set: set[UUID] = set()
        objective_id_set: set[UUID] = set()
        field_id_set: set[UUID] = set()
        cohort_id_set: set[UUID] = set()

        for scenario in result.scenarios or []:
            for pid in scenario.persona_ids or []:
                try:
                    persona_id_set.add(UUID(str(pid)))
                except (ValueError, AttributeError):
                    pass
            for sid in scenario.simulation_ids or []:
                try:
                    simulation_id_set.add(UUID(str(sid)))
                except (ValueError, AttributeError):
                    pass
            for did in scenario.department_ids or []:
                try:
                    department_id_set.add(UUID(str(did)))
                except (ValueError, AttributeError):
                    pass
            for oid in scenario.objective_ids or []:
                try:
                    objective_id_set.add(UUID(str(oid)))
                except (ValueError, AttributeError):
                    pass
            for fid in scenario.field_ids or []:
                try:
                    field_id_set.add(UUID(str(fid)))
                except (ValueError, AttributeError):
                    pass
            for cid in scenario.cohort_ids or []:
                try:
                    cohort_id_set.add(UUID(str(cid)))
                except (ValueError, AttributeError):
                    pass

        # 2. Parallel fetch via asyncio.gather + pool connections
        personas_data = []
        simulations_data = []
        departments_data = []
        objectives_data = []
        fields_data = []
        cohorts_data = []

        pool = get_pool()
        has_ids = any(
            [
                persona_id_set,
                simulation_id_set,
                department_id_set,
                objective_id_set,
                field_id_set,
                cohort_id_set,
            ]
        )

        if pool and has_ids:

            async def fetch_personas() -> list:
                if not persona_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_personas_internal(
                        c, list(persona_id_set), bypass_cache
                    )

            async def fetch_simulations() -> list:
                if not simulation_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_simulations_internal(
                        c, list(simulation_id_set), bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, list(department_id_set), bypass_cache
                    )

            async def fetch_objectives() -> list:
                if not objective_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_objectives_internal(
                        c, list(objective_id_set), bypass_cache
                    )

            async def fetch_fields() -> list:
                if not field_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_fields_internal(
                        c, list(field_id_set), bypass_cache
                    )

            async def fetch_cohorts() -> list:
                if not cohort_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_cohorts_internal(
                        c, list(cohort_id_set), bypass_cache
                    )

            (
                personas_data,
                simulations_data,
                departments_data,
                objectives_data,
                fields_data,
                cohorts_data,
            ) = await asyncio.gather(
                fetch_personas(),
                fetch_simulations(),
                fetch_departments(),
                fetch_objectives(),
                fetch_fields(),
                fetch_cohorts(),
            )

        # 3. Assemble mapping arrays
        api_objectives: list[ListScenarioApiObjective] = [
            ListScenarioApiObjective(
                objective_id=str(o.objective_id) if o.objective_id else None,
                name=getattr(o, "objective", None) or "",
                description=getattr(o, "objective", None) or "",
            )
            for o in objectives_data
        ]

        api_fields: list[ListScenarioApiField] = [
            ListScenarioApiField(
                field_id=str(f.field_id) if f.field_id else None,
                name=f.name,
                description=f.description or "",
            )
            for f in fields_data
        ]

        api_cohorts: list[ListScenarioApiCohort] = [
            ListScenarioApiCohort(
                cohort_id=str(c.cohort_id) if c.cohort_id else None,
                name=getattr(c, "name", None) or "",
                description=c.description or "",
            )
            for c in cohorts_data
        ]

        api_personas: list[ListScenarioApiPersona] = [
            ListScenarioApiPersona(
                persona_id=str(p.persona_id) if p.persona_id else None,
                name=p.name or "",
                description=p.description or "",
                color=getattr(p, "color", None) or "",
                icon=getattr(p, "icon", None) or "",
            )
            for p in personas_data
        ]

        api_simulations: list[ListScenarioApiSimulation] = [
            ListScenarioApiSimulation(
                simulation_id=str(s.simulation_id) if s.simulation_id else None,
                name=getattr(s, "name", None) or "",
                description=s.description or "",
                department_ids=getattr(s, "department_ids", None),
            )
            for s in simulations_data
        ]

        api_departments: list[ListScenarioApiDepartment] = [
            ListScenarioApiDepartment(
                department_id=str(d.department_id) if d.department_id else None,
                name=d.name or "",
                description=d.description or "",
            )
            for d in departments_data
        ]

        # Compute permissions in Python for each scenario
        api_scenarios: list[ListScenarioApiScenario] = []
        for s in result.scenarios or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                scenario_department_ids=s.department_ids,
                active_simulation_count=s.active_simulation_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                scenario_department_ids=s.department_ids,
                active_simulation_count=s.active_simulation_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            api_scenarios.append(
                ListScenarioApiScenario(
                    scenario_id=s.scenario_id,
                    name=s.name,
                    problem_statement=s.problem_statement,
                    is_inactive=s.is_inactive,
                    generated=s.generated,
                    mcp=getattr(s, "mcp", None),
                    department_ids=s.department_ids,
                    objective_ids=s.objective_ids,
                    persona_ids=s.persona_ids,
                    field_ids=s.field_ids,
                    simulation_ids=s.simulation_ids,
                    num_simulations=s.num_simulations,
                    active_simulation_count=s.active_simulation_count,
                    can_edit=can_edit_val,
                    can_delete=can_delete_val,
                    can_duplicate=can_duplicate_val,
                    cohort_ids=s.cohort_ids,
                    updated_at=s.updated_at,
                )
            )

        # Build API response
        api_response = ListScenarioApiResponse(
            actor_name=actor_name,
            scenarios=api_scenarios,
            objectives=api_objectives,
            fields=api_fields,
            cohorts=api_cohorts,
            personas=api_personas,
            simulations=api_simulations,
            departments=api_departments,
            persona_filter=ListFilterSection.from_sql_options(
                result.persona_options,
                request.persona_ids,
                request.persona_search,
            ),
            simulation_filter=ListFilterSection.from_sql_options(
                result.simulation_options,
                request.simulation_ids,
                request.simulation_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            total_count=result.total_count,
            import_fields=SCENARIO_IMPORT_FIELDS,
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
            operation="get_scenario_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

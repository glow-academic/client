"""Scenarios list endpoint - v4 API following DHH principles.

Resource-first: SQL only touches scenario_artifact + scenario's own junctions + resource tables.
Permissions (can_edit, can_delete, can_duplicate) computed in SQL.
Mapping arrays (objectives/fields/cohorts/personas/simulations/departments) hydrated in Python
via cached *_internal() functions.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.types import (
    GetScenariosListApiRequest,
    GetScenariosListSqlParams,
    ListScenarioApiCohort,
    ListScenarioApiDepartment,
    ListScenarioApiField,
    ListScenarioApiObjective,
    ListScenarioApiPersona,
    ListScenarioApiResponse,
    ListScenarioApiSimulation,
    ListScenarioSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/scenario/get_scenarios_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListScenarioApiResponse,
    dependencies=[
        audit_activity("scenarios.list", "{{ actor.name }} visited the Scenarios page")
    ],
)
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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=bypass_cache,
                )
                actor_name = resolved_context.actor_name
        else:
            actor_name = None

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

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

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
                    return await get_simulations_batch_internal(
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
                name=getattr(c, "title", None) or getattr(c, "name", None) or "",
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
                name=getattr(s, "title", None) or getattr(s, "name", None) or "",
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

        # Build API response
        api_response = ListScenarioApiResponse(
            actor_name=actor_name,
            scenarios=result.scenarios,
            objectives=api_objectives,
            fields=api_fields,
            cohorts=api_cohorts,
            personas=api_personas,
            simulations=api_simulations,
            departments=api_departments,
            persona_options=result.persona_options,
            simulation_options=result.simulation_options,
            department_options=result.department_options,
            total_count=result.total_count,
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

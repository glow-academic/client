"""Simulations list endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetSimulationsListApiRequest,
                           GetSimulationsListApiResponse,
                           GetSimulationsListSqlParams, GetSimulationsListSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/get_simulations_list_complete.sql"


# Legacy response models for backward compatibility (will be removed after frontend update)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None


class RubricMappingItem(BaseModel):
    """Rubric mapping item."""

    name: str
    description: str


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str] = []
    persona_mapping: dict[str, PersonaMappingItem] = {}
    document_mapping: dict[str, Any] = {}
    parameter_item_mapping: dict[str, Any] = {}
    parameter_item_ids: list[str] = []
    document_ids: list[str] = []


class SimulationItem(BaseModel):
    """Simulation item in list response."""

    simulation_id: str
    name: str
    description: str
    department_ids: list[str] | None
    time_limit: int | None
    active: bool
    practice_simulation: bool
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    scenario_ids: list[str]
    rubric_id: str
    num_cohorts: int
    cohort_ids: list[str]
    updated_at: str


class SimulationsListResponse(BaseModel):
    """Response for simulations list endpoint."""

    simulations: list[SimulationItem]
    scenario_mapping: dict[str, ScenarioMappingItem]
    rubric_mapping: dict[str, RubricMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    cohort_mapping: dict[str, CohortMappingItem]
    rubric_options: list[dict[str, str]]
    cohort_options: list[dict[str, str]]
    department_options: list[dict[str, str]]


router = APIRouter()


@router.post(
    "/list",
    response_model=SimulationsListResponse,
    dependencies=[
        audit_activity(
            "simulations.list", "{{ actor.name }} visited the Simulations page"
        )
    ],
)
async def get_simulations_list(
    filters: GetSimulationsListApiRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    tags = ["simulations"]

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SimulationsListResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params
        params = GetSimulationsListSqlParams(**filters.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetSimulationsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(request, actor={"name": result.actor_name, "id": profile_id})

        # Convert arrays to dicts for backward compatibility
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        if result.scenarios:
            for scenario in result.scenarios:
                persona_mapping: dict[str, PersonaMappingItem] = {}
                if scenario.persona_mapping:
                    for persona in scenario.persona_mapping:
                        persona_mapping[str(persona.persona_id)] = PersonaMappingItem(
                            name=persona.name or "",
                            description=persona.description or "",
                            color=persona.color or "",
                            icon=persona.icon or "",
                            image_model=persona.image_model or False,
                        )
                
                scenario_mapping[str(scenario.scenario_id)] = ScenarioMappingItem(
                    name=scenario.name or "",
                    description=scenario.description or "",
                    persona_ids=[str(pid) for pid in scenario.persona_ids] if scenario.persona_ids else [],
                    persona_mapping=persona_mapping,
                    document_mapping={},  # Empty for now - will be populated when frontend is updated
                    parameter_item_mapping={},  # Empty for now
                    parameter_item_ids=scenario.parameter_item_ids or [],
                    document_ids=scenario.document_ids or [],
                )

        rubric_mapping: dict[str, RubricMappingItem] = {}
        if result.rubrics:
            for rubric in result.rubrics:
                rubric_mapping[str(rubric.rubric_id)] = RubricMappingItem(
                    name=rubric.name or "",
                    description=rubric.description or "",
                )

        department_mapping: dict[str, DepartmentMappingItem] = {}
        if result.departments:
            for dept in result.departments:
                department_mapping[str(dept.department_id)] = DepartmentMappingItem(
                    name=dept.name or "",
                    description=dept.description or "",
                )

        cohort_mapping: dict[str, CohortMappingItem] = {}
        if result.cohorts:
            for cohort in result.cohorts:
                cohort_mapping[str(cohort.cohort_id)] = CohortMappingItem(
                    name=cohort.name or "",
                    description=cohort.description or "",
                )

        # Build simulation items
        simulations = []
        if result.simulations:
            for sim in result.simulations:
                scenario_ids = [str(sid) for sid in (sim.scenario_ids or [])]
                dept_ids = None
                if sim.department_ids:
                    dept_ids = [str(d) for d in sim.department_ids]
                cohort_ids = [str(cid) for cid in (sim.cohort_ids or [])]

                simulations.append(
                    SimulationItem(
                        simulation_id=str(sim.simulation_id),
                        name=sim.name or "",
                        description=sim.description or "",
                        department_ids=dept_ids,
                        time_limit=sim.time_limit,
                        active=sim.active or False,
                        practice_simulation=sim.practice_simulation or False,
                        can_edit=sim.can_edit or False,
                        can_delete=sim.can_delete or False,
                        can_duplicate=sim.can_duplicate or False,
                        scenario_ids=scenario_ids,
                        rubric_id=str(sim.rubric_id) if sim.rubric_id else "",
                        num_cohorts=sim.num_cohorts or 0,
                        cohort_ids=cohort_ids,
                        updated_at=sim.updated_at or "",
                    )
                )

        # Build facet options from arrays
        rubric_options = []
        if result.rubric_options:
            rubric_options = [
                {"value": opt.value or "", "label": opt.label or ""}
                for opt in result.rubric_options
            ]
        else:
            # Fallback: build from rubric_mapping
            rubric_options = [
                {"value": rid, "label": r.name} for (rid, r) in rubric_mapping.items()
            ]

        cohort_options = []
        if result.cohort_options:
            cohort_options = [
                {"value": opt.value or "", "label": opt.label or ""}
                for opt in result.cohort_options
            ]
        else:
            # Fallback: build from cohort_mapping
            cohort_options = [
                {"value": cid, "label": c.name} for (cid, c) in cohort_mapping.items()
            ]

        # Filter department_options to only include user departments
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            profile_id,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        department_options = []
        if result.department_options:
            department_options = [
                {"value": opt.value or "", "label": opt.label or ""}
                for opt in result.department_options
                if opt.value in user_department_ids
            ]
        else:
            # Fallback: build from department_mapping
            department_options = [
                {"value": did, "label": d.name or did}
                for (did, d) in department_mapping.items()
                if did in user_department_ids
            ]

        response_data = SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
            rubric_options=rubric_options,
            cohort_options=cohort_options,
            department_options=department_options,
        )

        # Cache response (use mode='json' to serialize UUIDs)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode='json')},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_simulations_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

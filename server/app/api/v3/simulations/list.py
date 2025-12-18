"""Simulations list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
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


# Type aliases for Dict mappings (defined before ScenarioMappingItem to avoid forward reference issues)
DepartmentMapping = dict[str, "DepartmentMappingItem"]
CohortMapping = dict[str, "CohortMappingItem"]
PersonaMapping = dict[str, "PersonaMappingItem"]
RubricMapping = dict[str, "RubricMappingItem"]
ScenarioMapping = dict[str, "ScenarioMappingItem"]


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str] = []
    persona_mapping: PersonaMapping = {}
    document_mapping: dict[str, Any] = {}
    parameter_item_mapping: dict[str, Any] = {}
    parameter_item_ids: list[str] = []
    document_ids: list[str] = []


# Inline request/response schemas
class SimulationsFilters(BaseModel):
    """Filters for simulations list."""

    # profileId removed - comes from X-Profile-Id header


class SimulationItem(BaseModel):
    """Simulation item in list response."""

    simulation_id: str
    name: str  # Maps to simulations.title
    description: str
    department_ids: list[str] | None  # None = cross-department (all departments)
    time_limit: int | None
    active: bool
    practice_simulation: bool
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    scenario_ids: list[str]
    rubric_id: str
    num_cohorts: int  # Number of cohorts using this simulation
    cohort_ids: list[str]  # Array of cohort IDs linked to this simulation
    updated_at: str


class SimulationsListResponse(BaseModel):
    """Response for simulations list endpoint."""

    simulations: list[SimulationItem]
    scenario_mapping: ScenarioMapping
    rubric_mapping: RubricMapping
    department_mapping: DepartmentMapping
    cohort_mapping: CohortMapping
    # UI-ready facet options (precomputed on server)
    rubric_options: list[dict[str, str]]  # Array of {value, label}
    cohort_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post(
    "/list",
    response_model=SimulationsListResponse,
    dependencies=[
        audit_activity("simulations.list", "{{ actor.name }} visited the Simulations page")
    ],
)
async def get_simulations_list(
    filters: SimulationsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    tags = ["simulations"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SimulationsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Load SQL string
        sql_query = load_sql("sql/v3/simulations/list_simulations.sql")
        sql_params = (profile_id,)

        # Execute query
        result = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = result[0]["actor_name"] if result else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Build response - transform database rows
        simulations = []
        scenario_mapping: ScenarioMapping = {}
        rubric_mapping: RubricMapping = {}
        department_mapping: DepartmentMapping = {}
        cohort_mapping: CohortMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse scenario mapping from JSONB
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        # Parse nested persona_mapping
                        persona_mapping_parsed: PersonaMapping = {}
                        persona_mapping_raw = sdata.get("persona_mapping", {})
                        if isinstance(persona_mapping_raw, str):
                            persona_mapping_raw = json.loads(persona_mapping_raw)
                        if persona_mapping_raw and isinstance(
                            persona_mapping_raw, dict
                        ):
                            for pid, pdata in persona_mapping_raw.items():
                                if isinstance(pdata, dict):
                                    persona_mapping_parsed[pid] = PersonaMappingItem(
                                        name=pdata.get("name", ""),
                                        description=pdata.get("description", ""),
                                        color=pdata.get("color", ""),
                                        icon=pdata.get("icon", ""),
                                        image_model=pdata.get("image_model", False),
                                    )

                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_ids=sdata.get("persona_ids", []),
                            persona_mapping=persona_mapping_parsed,
                            document_mapping=sdata.get("document_mapping", {}),
                            parameter_item_mapping=sdata.get("field_mapping", {}),
                            parameter_item_ids=sdata.get("parameter_item_ids", []),
                            document_ids=sdata.get("document_ids", []),
                        )

            # Parse rubric mapping from JSONB
            rubric_mapping_data = first_row.get("rubric_mapping")
            if isinstance(rubric_mapping_data, str):
                rubric_mapping_data = json.loads(rubric_mapping_data)
            if rubric_mapping_data and isinstance(rubric_mapping_data, dict):
                for rid, rdata in rubric_mapping_data.items():
                    if isinstance(rdata, dict):
                        rubric_mapping[rid] = RubricMappingItem(
                            name=rdata.get("name", ""),
                            description=rdata.get("description", ""),
                        )

            # Parse department_mapping from JSONB
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for did, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

            # Parse cohort_mapping from JSONB
            cohort_mapping_data = first_row.get("cohort_mapping")
            if isinstance(cohort_mapping_data, str):
                cohort_mapping_data = json.loads(cohort_mapping_data)
            if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
                for cid, cdata in cohort_mapping_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

        # Build simulation items
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]
            cohort_ids = [str(cid) for cid in (row.get("cohort_ids") or [])]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row["simulation_id"]),
                    name=row["name"],
                    description=row["description"] or "",
                    department_ids=dept_ids,
                    time_limit=row["time_limit"],
                    active=row["active"],
                    practice_simulation=row["practice_simulation"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    scenario_ids=scenario_ids,
                    rubric_id=str(row["rubric_id"]) if row["rubric_id"] else "",
                    num_cohorts=row["num_cohorts"],
                    cohort_ids=cohort_ids,
                    updated_at=str(row["updated_at"]),
                )
            )

        # Get user departments for scoping department_options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            profile_id,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Build facet options
        rubric_options = [
            {"value": rid, "label": r.name} for (rid, r) in rubric_mapping.items()
        ]
        cohort_options = [
            {"value": cid, "label": c.name} for (cid, c) in cohort_mapping.items()
        ]
        # Filter department_options to only include user departments (like cohorts list)
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

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
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

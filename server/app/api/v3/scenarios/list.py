"""Scenarios list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (
    CohortMapping,
    CohortMappingItem,
    DepartmentMapping,
    DepartmentMappingItem,
    ObjectiveMapping,
    ObjectiveMappingItem,
    ParameterItemMapping,
    ParameterItemMappingItem,
    PersonaMapping,
    PersonaMappingItem,
    SimulationMapping,
    SimulationMappingItem,
)
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ScenariosFilters(BaseModel):
    """Filters for scenarios list request."""

    profileId: str


class ScenarioItem(BaseModel):
    """Individual scenario item in the response."""

    scenario_id: str
    title: str  # Maps to scenarios.name
    problem_statement: str
    active: bool
    generated: bool
    parent_scenario_id: str | None
    department_ids: list[str] | None  # None = cross-department (all departments)
    objective_ids: list[str]  # "scenarioId_idx" composite keys
    persona_ids: list[str]
    parameter_item_ids: list[str]
    parameter_items: list[
        ParameterItemMappingItem
    ]  # Computed: actual parameter item objects
    simulation_ids: list[str]
    num_simulations: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    cohort_ids: list[str]
    updated_at: str


class ScenariosListResponse(BaseModel):
    """Response for scenarios list endpoint."""

    scenarios: list[ScenarioItem]
    objective_mapping: ObjectiveMapping
    parameter_item_mapping: ParameterItemMapping
    cohort_mapping: CohortMapping
    persona_mapping: PersonaMapping
    simulation_mapping: SimulationMapping
    department_mapping: DepartmentMapping
    # UI-ready facet options (precomputed on server)
    persona_options: list[dict[str, str]]  # Array of {value, label}
    simulation_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post("/list", response_model=ScenariosListResponse)
async def get_scenarios_list(
    filters: ScenariosFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenariosListResponse:
    """Get scenarios list with all relationships."""
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ScenariosListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/scenarios/list_scenarios.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Build response - transform database rows
        scenarios = []
        objective_mapping: ObjectiveMapping = {}
        parameter_item_mapping: ParameterItemMapping = {}
        cohort_mapping: CohortMapping = {}
        persona_mapping: PersonaMapping = {}
        simulation_mapping: SimulationMapping = {}
        department_mapping: DepartmentMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse objective mapping from JSONB
            objective_mapping_data = first_row.get("objective_mapping")
            if isinstance(objective_mapping_data, str):
                objective_mapping_data = json.loads(objective_mapping_data)
            if objective_mapping_data and isinstance(objective_mapping_data, dict):
                for oid, odata in objective_mapping_data.items():
                    if isinstance(odata, dict):
                        objective_mapping[oid] = ObjectiveMappingItem(
                            name=odata.get("name", ""),
                            description=odata.get("description", ""),
                        )

            # Parse parameter_item mapping from JSONB
            parameter_item_mapping_data = first_row.get("parameter_item_mapping")
            if isinstance(parameter_item_mapping_data, str):
                parameter_item_mapping_data = json.loads(parameter_item_mapping_data)
            if parameter_item_mapping_data and isinstance(
                parameter_item_mapping_data, dict
            ):
                for pid, pdata in parameter_item_mapping_data.items():
                    if isinstance(pdata, dict):
                        parameter_item_mapping[pid] = ParameterItemMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            parameter_id=str(pdata["parameter_id"])
                            if pdata.get("parameter_id")
                            else "",
                            parameter_name=pdata.get("parameter_name", ""),
                        )

            # Parse cohort mapping from JSONB
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

            # Parse persona mapping from JSONB
            persona_mapping_data = first_row.get("persona_mapping")
            if isinstance(persona_mapping_data, str):
                persona_mapping_data = json.loads(persona_mapping_data)
            if persona_mapping_data and isinstance(persona_mapping_data, dict):
                for persona_id, pdata in persona_mapping_data.items():
                    if isinstance(pdata, dict):
                        persona_mapping[persona_id] = PersonaMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            color=pdata.get("color", ""),
                            icon=pdata.get("icon", ""),
                            image_model=pdata.get("image_model", False),
                        )

            # Parse simulation mapping from JSONB
            simulation_mapping_data = first_row.get("simulation_mapping")
            if isinstance(simulation_mapping_data, str):
                simulation_mapping_data = json.loads(simulation_mapping_data)
            if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
                for sim_id, sdata in simulation_mapping_data.items():
                    if isinstance(sdata, dict):
                        # Handle department_ids - may be array or null
                        dept_ids = sdata.get("department_ids")
                        if isinstance(dept_ids, str):
                            try:
                                dept_ids = json.loads(dept_ids)
                            except (json.JSONDecodeError, ValueError):
                                dept_ids = [dept_ids] if dept_ids else None
                        elif dept_ids is None:
                            dept_ids = None
                        elif not isinstance(dept_ids, list):
                            dept_ids = [dept_ids] if dept_ids else None

                        simulation_mapping[sim_id] = SimulationMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            time_limit=sdata.get("time_limit"),
                            department_ids=dept_ids,
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

        # Build scenario items
        for row in result:
            objective_ids = row["objective_ids"] or []
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            simulation_ids = [str(sid) for sid in (row["simulation_ids"] or [])]
            cohort_ids = [str(cid) for cid in (row["cohort_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Compute parameter_items: map IDs to actual objects from mapping
            parameter_items = [
                parameter_item_mapping[pid]
                for pid in parameter_item_ids
                if pid in parameter_item_mapping
            ]

            scenarios.append(
                ScenarioItem(
                    scenario_id=str(row["scenario_id"]),
                    title=row["title"],
                    problem_statement=row["problem_statement"],
                    active=row["active"],
                    generated=row["generated"],
                    parent_scenario_id=row["parent_scenario_id"],
                    department_ids=dept_ids,
                    objective_ids=objective_ids,
                    persona_ids=row.get("persona_ids") or [],
                    parameter_item_ids=parameter_item_ids,
                    parameter_items=parameter_items,
                    simulation_ids=simulation_ids,
                    num_simulations=row["num_simulations"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    cohort_ids=cohort_ids,
                    updated_at=str(row["updated_at"]),
                )
            )

        # Build facet options
        persona_options = [
            {"value": pid, "label": p.name} for (pid, p) in persona_mapping.items()
        ]
        simulation_options = [
            {"value": sid, "label": s.name} for (sid, s) in simulation_mapping.items()
        ]
        # Collect all department IDs actually assigned to scenarios
        assigned_department_ids = set()
        for scenario in scenarios:
            if scenario.department_ids:
                assigned_department_ids.update(scenario.department_ids)
        # Filter department_options to only include departments assigned to at least one scenario
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        ]

        response_data = ScenariosListResponse(
            scenarios=scenarios,
            objective_mapping=objective_mapping,
            parameter_item_mapping=parameter_item_mapping,
            cohort_mapping=cohort_mapping,
            persona_mapping=persona_mapping,
            simulation_mapping=simulation_mapping,
            department_mapping=department_mapping,
            persona_options=persona_options,
            simulation_options=simulation_options,
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
            operation="get_scenarios_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

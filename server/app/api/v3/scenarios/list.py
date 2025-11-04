"""Scenarios list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.schema import (CohortMapping, CohortMappingItem,
                              DepartmentMapping, DepartmentMappingItem,
                              ObjectiveMapping, ObjectiveMappingItem,
                              ParameterItemMapping, ParameterItemMappingItem,
                              PersonaMapping, PersonaMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


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
    simulation_ids: list[str]
    num_simulations: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    cohort_ids: list[str]


class ScenariosListResponse(BaseModel):
    """Response for scenarios list endpoint."""

    scenarios: list[ScenarioItem]
    objective_mapping: ObjectiveMapping
    parameter_item_mapping: ParameterItemMapping
    cohort_mapping: CohortMapping
    persona_mapping: PersonaMapping
    simulation_mapping: SimulationMapping
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post("/list", response_model=ScenariosListResponse)
async def get_scenarios_list(
    filters: ScenariosFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenariosListResponse:
    """Get scenarios list with all relationships."""
    try:
        # Load SQL string
        sql = load_sql("sql/v3/scenarios/list_scenarios.sql")

        # Execute query
        result = await conn.fetch(sql, filters.profileId)

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
                            value=pdata.get("value", ""),
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
                    simulation_ids=simulation_ids,
                    num_simulations=row["num_simulations"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    cohort_ids=cohort_ids,
                )
            )

        return ScenariosListResponse(
            scenarios=scenarios,
            objective_mapping=objective_mapping,
            parameter_item_mapping=parameter_item_mapping,
            cohort_mapping=cohort_mapping,
            persona_mapping=persona_mapping,
            simulation_mapping=simulation_mapping,
            department_mapping=department_mapping,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


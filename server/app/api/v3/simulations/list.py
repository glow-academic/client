"""Simulations list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import (
    DepartmentMapping,
    DepartmentMappingItem,
    RubricMapping,
    RubricMappingItem,
    ScenarioMapping,
    ScenarioMappingItem,
)
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class SimulationsFilters(BaseModel):
    """Filters for simulations list."""

    profileId: str


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


class SimulationsListResponse(BaseModel):
    """Response for simulations list endpoint."""

    simulations: list[SimulationItem]
    scenario_mapping: ScenarioMapping
    rubric_mapping: RubricMapping
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post("/list")
async def get_simulations_list(
    filters: SimulationsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    try:
        # Load SQL string
        sql = load_sql("sql/v3/simulations/list_simulations.sql")

        # Execute query
        result = await conn.fetch(sql, filters.profileId)

        # Build response - transform database rows
        simulations = []
        scenario_mapping: ScenarioMapping = {}
        rubric_mapping: RubricMapping = {}
        department_mapping: DepartmentMapping = {}

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
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_ids=sdata.get("persona_ids", []),
                            persona_mapping=sdata.get("persona_mapping", {}),
                            document_mapping=sdata.get("document_mapping", {}),
                            parameter_item_mapping=sdata.get("parameter_item_mapping", {}),
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

        # Build simulation items
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

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
                )
            )

        return SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


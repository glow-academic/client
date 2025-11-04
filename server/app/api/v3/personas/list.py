"""Personas list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import (
    DepartmentMapping,
    DepartmentMappingItem,
    ModelMapping,
    ModelMappingItem,
    ScenarioMapping,
    ScenarioMappingItem,
)
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class PersonasFilters(BaseModel):
    """Filters for personas list request."""

    profileId: str


class PersonaItem(BaseModel):
    """Individual persona item in the response."""

    persona_id: str
    name: str
    description: str | None
    color: str
    icon: str
    department_ids: list[str] | None  # None = cross-department (all departments)
    scenario_ids: list[str]  # Array of scenario IDs
    model_id: str
    reasoning: str | None
    temperature: float
    active: bool
    num_scenarios: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


class PersonasListResponse(BaseModel):
    """Response for personas list endpoint."""

    personas: list[PersonaItem]
    scenario_mapping: ScenarioMapping
    model_mapping: ModelMapping
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post("/list")
async def get_personas_list(
    filters: PersonasFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonasListResponse:
    """Get personas list with permissions and scenario details."""
    try:
        # Load SQL string
        sql = load_sql("sql/v3/personas/list_personas.sql")

        # Execute query
        result = await conn.fetch(sql, filters.profileId)

        # Build response - transform database rows
        personas = []
        scenario_mapping: ScenarioMapping = {}
        model_mapping: ModelMapping = {}
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

        # Build persona items
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            personas.append(
                PersonaItem(
                    persona_id=str(row["persona_id"]),
                    name=row["persona_name"],
                    description=row["description"],
                    color=row["color"],
                    icon=row["icon"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    model_id=str(row["model_id"]) if row["model_id"] else "",
                    reasoning=row["reasoning"],
                    temperature=float(row["temperature"]) if row["temperature"] else 0.0,
                    active=row["active"],
                    num_scenarios=row["num_scenarios"],
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )

        return PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            model_mapping=model_mapping,
            department_mapping=department_mapping,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


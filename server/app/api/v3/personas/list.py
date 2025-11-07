"""Personas list endpoint - v3 API following DHH principles."""

import json
from collections import Counter
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem, ScenarioMapping,
                              ScenarioMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    model_name: str | None  # Precomputed model name
    reasoning: str | None
    temperature: float
    temperature_display: str  # Precomputed formatted temperature (e.g. "0.44")
    active: bool
    is_inactive: bool  # Mirror of !active for easier badge rendering
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
    # UI-ready facet options (precomputed on server)
    scenario_options: list[dict[str, str]]  # Array of {value, label}
    model_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


def disambiguate_scenarios(smap: ScenarioMapping) -> list[dict[str, str]]:
    """Build scenario options with disambiguation for duplicate names."""
    names = Counter([v.name for v in smap.values()])
    out = []
    for sid, v in smap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({sid[-8:]})"
        out.append({"value": sid, "label": label})
    return out


@router.post("/list", response_model=PersonasListResponse)
async def get_personas_list(
    filters: PersonasFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonasListResponse:
    """Get personas list with permissions and scenario details."""
    tags = ["personas"]  # From router tags
    
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
            return PersonasListResponse.model_validate(cached["data"])
    
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

        # Build model_mapping from SQL results (collect unique models)
        for row in result:
            model_id = str(row["model_id"]) if row["model_id"] else ""
            model_name = row.get("model_name")
            if model_id and model_id not in model_mapping and model_name:
                model_mapping[model_id] = ModelMappingItem(
                    name=model_name,
                    description=row.get("model_description") or "",
                )

        # Build persona items with derived fields
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            model_id = str(row["model_id"]) if row["model_id"] else ""
            temperature = float(row["temperature"]) if row["temperature"] else 0.0
            model_name = row.get("model_name")

            personas.append(
                PersonaItem(
                    persona_id=str(row["persona_id"]),
                    name=row["persona_name"],
                    description=row["description"],
                    color=row["color"],
                    icon=row["icon"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    model_id=model_id,
                    model_name=model_name,
                    reasoning=row["reasoning"],
                    temperature=temperature,
                    temperature_display=f"{temperature:.2f}",
                    active=row["active"],
                    is_inactive=not row["active"],
                    num_scenarios=row["num_scenarios"],
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )

        # Build facet options
        scenario_options = disambiguate_scenarios(scenario_mapping)
        model_options = [{"value": mid, "label": m.name} for (mid, m) in model_mapping.items()]
        department_options = [
            {"value": did, "label": d.name or did} for (did, d) in department_mapping.items()
        ]

        response_data = PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            model_mapping=model_mapping,
            department_mapping=department_mapping,
            scenario_options=scenario_options,
            model_options=model_options,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


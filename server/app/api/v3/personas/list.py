"""Personas list endpoint - v3 API following DHH principles."""

import json
from collections import Counter
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
    AgentMapping,
    AgentMappingItem,
    DepartmentMapping,
    DepartmentMappingItem,
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
    agent_id: str | None  # Primary agent ID (prefer text, fallback to voice)
    agent_name: str | None  # Primary agent name
    model_id: str | None  # Model ID from primary agent (for backward compatibility)
    model_name: str | None  # Model name from primary agent (for backward compatibility)
    reasoning: str | None
    temperature: float
    temperature_display: str  # Precomputed formatted temperature (e.g. "0.44")
    active: bool
    is_inactive: bool  # Mirror of !active for easier badge rendering
    num_scenarios: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    updated_at: str


class PersonasListResponse(BaseModel):
    """Response for personas list endpoint."""

    personas: list[PersonaItem]
    scenario_mapping: ScenarioMapping
    agent_mapping: AgentMapping
    department_mapping: DepartmentMapping
    # UI-ready facet options (precomputed on server)
    scenario_options: list[dict[str, str]]  # Array of {value, label}
    agent_options: list[dict[str, str]]  # Array of {value, label}
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

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/personas/list_personas.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Build response - transform database rows
        personas = []
        scenario_mapping: ScenarioMapping = {}
        agent_mapping: AgentMapping = {}
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
                            parameter_item_mapping=sdata.get(
                                "parameter_item_mapping", {}
                            ),
                            parameter_item_ids=sdata.get("parameter_item_ids", []),
                            document_ids=sdata.get("document_ids", []),
                        )

            # Parse agent_mapping from JSONB
            agent_mapping_data = first_row.get("agent_mapping")
            if isinstance(agent_mapping_data, str):
                agent_mapping_data = json.loads(agent_mapping_data)
            if agent_mapping_data and isinstance(agent_mapping_data, dict):
                for aid, adata in agent_mapping_data.items():
                    if isinstance(adata, dict):
                        agent_mapping[aid] = AgentMappingItem(
                            name=adata.get("name", ""),
                            description=adata.get("description", ""),
                            roles=adata.get("roles", []),
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

        # Build persona items with derived fields
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            agent_id = str(row["agent_id"]) if row["agent_id"] else None
            agent_name = row.get("agent_name")
            model_id = str(row["model_id"]) if row["model_id"] else None
            model_name = row.get("model_name")
            temperature = float(row["temperature"]) if row["temperature"] else 0.0

            personas.append(
                PersonaItem(
                    persona_id=str(row["persona_id"]),
                    name=row["persona_name"],
                    description=row["description"],
                    color=row["color"],
                    icon=row["icon"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    agent_id=agent_id,
                    agent_name=agent_name,
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
                    updated_at=str(row["updated_at"]),
                )
            )

        # Get user departments for scoping scenario_options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            filters.profileId,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Collect all scenario IDs from personas
        all_persona_scenario_ids = set()
        for persona in personas:
            all_persona_scenario_ids.update(persona.scenario_ids)

        # Check which scenarios are in user's departments (or cross-department)
        # Scenarios can be cross-department (no department links) or in specific departments
        valid_scenario_ids = set()
        if all_persona_scenario_ids:
            scenario_dept_rows = await conn.fetch(
                """
                SELECT DISTINCT sd.scenario_id::text
                FROM scenario_departments sd
                WHERE sd.scenario_id::text = ANY($1::text[])
                AND sd.department_id::text = ANY($2::text[])
                AND sd.active = true
                UNION
                SELECT DISTINCT s.id::text
                FROM scenarios s
                WHERE s.id::text = ANY($1::text[])
                AND NOT EXISTS (
                    SELECT 1 FROM scenario_departments sd2 
                    WHERE sd2.scenario_id = s.id AND sd2.active = true
                )
                """,
                list(all_persona_scenario_ids),
                list(user_department_ids),
            )
            valid_scenario_ids = {row["scenario_id"] for row in scenario_dept_rows}

        # Build facet options
        scenario_options = [
            opt
            for opt in disambiguate_scenarios(scenario_mapping)
            if opt["value"] in valid_scenario_ids
        ]
        # Collect all agent IDs actually assigned to personas
        assigned_agent_ids = set()
        for persona in personas:
            if persona.agent_id:
                assigned_agent_ids.add(persona.agent_id)
        # Filter agent_options to only include agents assigned to at least one persona
        agent_options = [
            {"value": aid, "label": a.name or aid}
            for (aid, a) in agent_mapping.items()
            if aid in assigned_agent_ids
        ]
        # Collect all department IDs actually assigned to personas
        assigned_department_ids = set()
        for persona in personas:
            if persona.department_ids:
                assigned_department_ids.update(persona.department_ids)
        # Filter department_options to only include departments assigned to at least one persona
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        ]

        response_data = PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            agent_mapping=agent_mapping,
            department_mapping=department_mapping,
            scenario_options=scenario_options,
            agent_options=agent_options,
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
            operation="get_personas_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

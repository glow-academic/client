"""Simulations list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (
    CohortMapping,
    CohortMappingItem,
    DepartmentMapping,
    DepartmentMappingItem,
    RubricMapping,
    RubricMappingItem,
    ScenarioMapping,
    ScenarioMappingItem,
)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    cohort_ids: list[str]  # Array of cohort IDs linked to this simulation


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


@router.post("/list", response_model=SimulationsListResponse)
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
        # Load SQL string
        sql_query = load_sql("sql/v3/simulations/list_simulations.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

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
                )
            )

        # Build facet options
        rubric_options = [
            {"value": rid, "label": r.name} for (rid, r) in rubric_mapping.items()
        ]
        cohort_options = [
            {"value": cid, "label": c.name} for (cid, c) in cohort_mapping.items()
        ]
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
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

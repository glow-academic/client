"""Cohort list endpoint - v3 API."""

import json
import os
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.schema import (
    DepartmentMappingItem,
    ProfileMappingItem,
    SimulationMappingItem,
)
from app.utils.sql_helper import load_sql


class CohortsListRequest(BaseModel):
    """Request for cohorts list."""

    profileId: str


class CohortItem(BaseModel):
    """Cohort item for list view."""

    cohort_id: str
    name: str
    description: str
    active: bool
    department_ids: list[str] | None = None
    profile_ids: list[str]
    simulation_ids: list[str]
    usage_count: int
    num_members: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    can_leave: bool


class CohortsListResponse(BaseModel):
    """Response for cohorts list."""

    cohorts: list[CohortItem]
    profile_mapping: dict[str, ProfileMappingItem]
    simulation_mapping: dict[str, SimulationMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    # UI-ready facet options (precomputed on server)
    profile_options: list[dict[str, str]]  # Array of {value, label}
    simulation_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


def disambiguate_profiles(pmap: dict[str, ProfileMappingItem]) -> list[dict[str, str]]:
    """Build profile options with disambiguation for duplicate names."""
    names = Counter([v.name for v in pmap.values()])
    out = []
    for pid, v in pmap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({pid[-8:]})"
        out.append({"value": pid, "label": label})
    return out


def disambiguate_simulations(
    smap: dict[str, SimulationMappingItem],
) -> list[dict[str, str]]:
    """Build simulation options with disambiguation for duplicate names."""
    names = Counter([v.name for v in smap.values()])
    out = []
    for sid, v in smap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({sid[-8:]})"
        out.append({"value": sid, "label": label})
    return out


@router.post("/list", response_model=CohortsListResponse)
async def get_cohorts_list(
    filters: CohortsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortsListResponse:
    """Get cohorts list with permissions and relationships."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return CohortsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")
        sql_query = load_sql("sql/v3/cohorts/list_cohorts.sql")
        sql_params = (filters.profileId, campus_domain)
        rows = await conn.fetch(sql_query, filters.profileId, campus_domain)

        cohorts = []
        profile_mapping: dict[str, ProfileMappingItem] = {}
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        for row in rows:
            # Convert UUID arrays to string arrays
            profile_ids = [str(pid) for pid in (row["profile_ids"] or [])]
            simulation_ids = [str(sid) for sid in (row["simulation_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            cohorts.append(
                CohortItem(
                    cohort_id=str(row["cohort_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row["active"],
                    department_ids=dept_ids,
                    profile_ids=profile_ids,
                    simulation_ids=simulation_ids,
                    usage_count=row["usage_count"],
                    num_members=row["num_members"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    can_leave=row["can_leave"],
                )
            )

            # Parse mappings from first row (same for all cohorts)
            if not profile_mapping and row["profile_mapping"]:
                profile_data = row["profile_mapping"]
                if isinstance(profile_data, str):
                    profile_data = json.loads(profile_data)
                if isinstance(profile_data, dict):
                    for pid, pdata in profile_data.items():
                        if isinstance(pdata, dict):
                            profile_mapping[pid] = ProfileMappingItem(
                                name=pdata.get("name", ""),
                                description=pdata.get("description", ""),
                            )

            if not simulation_mapping and row["simulation_mapping"]:
                sim_data = row["simulation_mapping"]
                if isinstance(sim_data, str):
                    sim_data = json.loads(sim_data)
                if isinstance(sim_data, dict):
                    for sid, sdata in sim_data.items():
                        if isinstance(sdata, dict):
                            dept_ids_val = sdata.get("department_ids")
                            if isinstance(dept_ids_val, str):
                                dept_ids_val = json.loads(dept_ids_val)
                            simulation_mapping[sid] = SimulationMappingItem(
                                name=sdata.get("name", ""),
                                description=sdata.get("description", ""),
                                time_limit=sdata.get("time_limit"),
                                department_ids=dept_ids_val
                                if isinstance(dept_ids_val, list)
                                else None,
                            )

            if not department_mapping and row["department_mapping"]:
                dept_data = row["department_mapping"]
                if isinstance(dept_data, str):
                    dept_data = json.loads(dept_data)
                if isinstance(dept_data, dict):
                    for did, ddata in dept_data.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata.get("name", ""),
                                description=ddata.get("description", ""),
                            )

        # Build facet options
        profile_options = disambiguate_profiles(profile_mapping)
        simulation_options = disambiguate_simulations(simulation_mapping)
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
        ]

        response_data = CohortsListResponse(
            cohorts=cohorts,
            profile_mapping=profile_mapping,
            simulation_mapping=simulation_mapping,
            department_mapping=department_mapping,
            profile_options=profile_options,
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
            operation="get_cohorts_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

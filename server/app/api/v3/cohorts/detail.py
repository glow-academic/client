"""Cohort detail endpoint - v3 API."""

import json
import os
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (CohortMappingItem, DepartmentMappingItem,
                              ProfileMappingItem, SimulationMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class CohortDetailRequest(BaseModel):
    """Request for cohort detail."""

    cohortId: str
    profileId: str


class SimulationInCohort(BaseModel):
    """Simulation with cohort-specific statistics."""

    simulation_id: str
    name: str
    description: str
    time_limit: int | None
    active: bool
    usage_count: int
    success_rate: int
    last_used: str | None
    can_remove: bool


class StaffItem(BaseModel):
    """Staff item for cohort detail."""

    profile_id: str
    first_name: str
    last_name: str
    alias: str
    name: str
    role: str
    email: str
    initials: str
    active: bool
    lastActive: str | None = None
    cohort_ids: list[str]
    department_ids: list[str]
    primary_department_id: str  # Primary department ID (for editing)
    requests_per_day: int | None = None
    total_requests: int
    default_profile: bool
    intro_completed: bool = False
    chat_completed: bool = False
    requests_in_last_day: int
    can_edit: bool
    can_delete: bool
    can_remove: bool


class CohortDetailResponse(BaseModel):
    """Response for cohort detail endpoint."""

    title: str
    description: str | None
    department_ids: list[str] | None
    valid_department_ids: list[str]
    active: bool
    simulation_ids: list[str]
    valid_simulation_ids: list[str]
    profile_ids: list[str]
    valid_profile_ids: list[str]
    simulations: list[SimulationInCohort]
    staff: list[StaffItem]
    simulation_mapping: dict[str, SimulationMappingItem]
    profile_mapping: dict[str, ProfileMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    cohort_mapping: dict[str, CohortMappingItem] | None = None
    department_mapping_for_staff: dict[str, DepartmentMappingItem] | None = None


router = APIRouter()


@router.post("/detail", response_model=CohortDetailResponse)
async def get_cohort_detail(
    request_body: CohortDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailResponse:
    """Get cohort detail with staff, simulations, and mappings."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return CohortDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")
        sql_query = load_sql("sql/v3/cohorts/get_cohort_detail_complete.sql")
        sql_params = (request_body.cohortId, request_body.profileId, campus_domain)
        row = await conn.fetchrow(
            sql_query, request_body.cohortId, request_body.profileId, campus_domain
        )

        if not row:
            raise HTTPException(status_code=404, detail="Cohort not found")

        # Parse simulations list from JSONB
        simulations: list[SimulationInCohort] = []
        if row.get("simulations_list"):
            sim_data = row["simulations_list"]
            if isinstance(sim_data, str):
                sim_data = json.loads(sim_data)
            if isinstance(sim_data, list):
                for sim in sim_data:
                    if isinstance(sim, dict):
                        last_used_val = sim.get("last_used")
                        last_used = (
                            last_used_val.isoformat()
                            if isinstance(last_used_val, datetime)
                            else None
                        )
                        simulations.append(
                            SimulationInCohort(
                                simulation_id=sim.get("simulation_id", ""),
                                name=sim.get("name", ""),
                                description=sim.get("description", ""),
                                time_limit=sim.get("time_limit"),
                                active=sim.get("active", False),
                                usage_count=sim.get("usage_count", 0),
                                success_rate=sim.get("success_rate", 0),
                                last_used=last_used,
                                can_remove=sim.get("can_remove", False),
                            )
                        )

        # Parse staff list from JSONB
        staff: list[StaffItem] = []
        if row.get("staff"):
            staff_data = row["staff"]
            if isinstance(staff_data, str):
                staff_data = json.loads(staff_data)
            if isinstance(staff_data, list):
                for s in staff_data:
                    if isinstance(s, dict):
                        last_active = None
                        if s.get("lastActive"):
                            last_active_val = s["lastActive"]
                            if isinstance(last_active_val, str):
                                last_active = last_active_val
                            elif hasattr(last_active_val, "isoformat"):
                                last_active = last_active_val.isoformat()
                            else:
                                last_active = str(last_active_val)
                        # Get primary department_id - ensure it always exists (default to empty string or first department)
                        department_ids = s.get("department_ids", [])
                        primary_department_id = s.get("primary_department_id") or ""
                        if not primary_department_id and department_ids:
                            # Fallback to first department if no primary department set
                            primary_department_id = department_ids[0] if isinstance(department_ids, list) and len(department_ids) > 0 else ""
                        
                        staff.append(
                            StaffItem(
                                profile_id=s.get("profile_id", ""),
                                first_name=s.get("first_name", ""),
                                last_name=s.get("last_name", ""),
                                alias=s.get("alias", ""),
                                name=s.get("name", ""),
                                role=s.get("role", ""),
                                email=s.get("email", ""),
                                initials=s.get("initials", ""),
                                active=s.get("active", False),
                                lastActive=last_active,
                                cohort_ids=s.get("cohort_ids", []),
                                department_ids=department_ids,
                                primary_department_id=primary_department_id,
                                requests_per_day=s.get("requests_per_day"),
                                total_requests=s.get("total_requests", 0),
                                default_profile=s.get("default_profile", False),
                                intro_completed=s.get("intro_completed", False),
                                chat_completed=s.get("chat_completed", False),
                                requests_in_last_day=s.get("requests_in_last_day", 0),
                                can_edit=s.get("can_edit", False),
                                can_delete=s.get("can_delete", False),
                                can_remove=s.get("can_remove", False),
                            )
                        )

        # Parse mappings
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        if row.get("simulation_mapping"):
            sim_map_data = row["simulation_mapping"]
            if isinstance(sim_map_data, str):
                sim_map_data = json.loads(sim_map_data)
            if isinstance(sim_map_data, dict):
                for sid, sdata in sim_map_data.items():
                    if isinstance(sdata, dict):
                        dept_ids = sdata.get("department_ids")
                        if isinstance(dept_ids, str):
                            dept_ids = json.loads(dept_ids)
                        simulation_mapping[sid] = SimulationMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            time_limit=sdata.get("time_limit"),
                            department_ids=dept_ids
                            if isinstance(dept_ids, list)
                            else None,
                        )

        profile_mapping: dict[str, ProfileMappingItem] = {}
        if row.get("profile_mapping"):
            prof_map_data = row["profile_mapping"]
            if isinstance(prof_map_data, str):
                prof_map_data = json.loads(prof_map_data)
            if isinstance(prof_map_data, dict):
                for pid, pdata in prof_map_data.items():
                    if isinstance(pdata, dict):
                        profile_mapping[pid] = ProfileMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                        )

        department_mapping: dict[str, DepartmentMappingItem] = {}
        if row.get("department_mapping"):
            dept_map_data = row["department_mapping"]
            if isinstance(dept_map_data, str):
                dept_map_data = json.loads(dept_map_data)
            if isinstance(dept_map_data, dict):
                for did, ddata in dept_map_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                            simulation_ids=ddata.get("simulation_ids"),
                            staff_ids=ddata.get("staff_ids"),
                        )

        cohort_mapping: dict[str, CohortMappingItem] | None = None
        if row.get("cohort_mapping_for_staff"):
            cohort_map_data = row["cohort_mapping_for_staff"]
            if isinstance(cohort_map_data, str):
                cohort_map_data = json.loads(cohort_map_data)
            if isinstance(cohort_map_data, dict):
                cohort_mapping = {}
                for cid, cdata in cohort_map_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

        department_mapping_for_staff: dict[str, DepartmentMappingItem] | None = None
        if row.get("department_mapping_for_staff"):
            dept_staff_data = row["department_mapping_for_staff"]
            if isinstance(dept_staff_data, str):
                dept_staff_data = json.loads(dept_staff_data)
            if isinstance(dept_staff_data, dict):
                department_mapping_for_staff = {}
                for did, ddata in dept_staff_data.items():
                    if isinstance(ddata, dict):
                        department_mapping_for_staff[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Convert UUID arrays to string arrays
        profile_ids = [str(pid) for pid in (row.get("profile_ids") or [])]
        simulation_ids = [str(sid) for sid in (row.get("simulation_ids") or [])]
        valid_profile_ids = [str(pid) for pid in (row.get("valid_profile_ids") or [])]
        valid_simulation_ids = [
            str(sid) for sid in (row.get("valid_simulation_ids") or [])
        ]
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        response_data = CohortDetailResponse(
            title=row.get("title", ""),
            description=row.get("description"),
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            active=row.get("active", False),
            simulation_ids=simulation_ids,
            valid_simulation_ids=valid_simulation_ids,
            profile_ids=profile_ids,
            valid_profile_ids=valid_profile_ids,
            simulations=simulations,
            staff=staff,
            simulation_mapping=simulation_mapping,
            profile_mapping=profile_mapping,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
            department_mapping_for_staff=department_mapping_for_staff,
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
            operation="get_cohort_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

"""Cohort detail endpoint - v3 API."""

import json
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str
    simulation_ids: list[str] | None = None
    staff_ids: list[str] | None = None  # Used in new.py for staff mapping


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


class ProfileMappingItem(BaseModel):
    """Profile mapping item."""

    name: str
    description: str


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class CohortDetailRequest(BaseModel):
    """Request for cohort detail."""

    cohortId: str
    # profileId removed - comes from X-Profile-Id header


class SimulationInCohort(BaseModel):
    """Simulation with cohort-specific statistics."""

    simulation_id: str
    name: str
    description: str
    time_limit: int | None
    active: bool
    position: int  # Position in cohort (from cohort_simulations.position)
    usage_count: int
    success_rate: int
    last_used: str | None
    can_remove: bool


class StaffItem(BaseModel):
    """Staff item for cohort detail."""

    profile_id: str
    first_name: str
    last_name: str
    emails: list[str]  # List of all active emails
    primary_email: str | None  # Primary email (first in emails array if exists)
    name: str
    role: str
    initials: str
    active: bool
    lastActive: str | None = None
    cohort_ids: list[str]
    department_ids: list[str]
    primary_department_id: str  # Primary department ID (for editing)
    requests_per_day: int | None = None
    total_requests: int
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
    can_edit: bool
    simulation_ids: list[str]
    valid_simulation_ids: list[str]
    profile_ids: list[str]
    simulations: list[SimulationInCohort]
    simulation_mapping: dict[str, dict[str, Any]]
    department_mapping: dict[str, dict[str, Any]]


router = APIRouter()


@router.post(
    "/detail",
    response_model=CohortDetailResponse,
    dependencies=[
        audit_activity(
            "cohort.viewed", "{{ actor.name }} viewed cohort '{{ cohort.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/cohorts/get_cohort_detail_complete.sql")
        sql_params = (request_body.cohortId, profile_id)
        row = await conn.fetchrow(sql_query, request_body.cohortId, profile_id)

        if not row:
            # Check if cohort exists but user doesn't have department access
            cohort_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM cohorts WHERE id = $1)",
                request_body.cohortId,
            )
            if cohort_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this cohort. It may be restricted to other departments.",
                )
            raise HTTPException(status_code=404, detail="Cohort not found")

        # Set audit context with data from SQL query
        actor_name = row.get("actor_name")
        cohort_name = row.get("title")
        if actor_name:
            audit_set(
                request,
                actor={"name": actor_name, "id": profile_id},
                cohort={"name": cohort_name, "id": request_body.cohortId},
            )

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
                                position=sim.get("position", 0),
                                usage_count=sim.get("usage_count", 0),
                                success_rate=sim.get("success_rate", 0),
                                last_used=last_used,
                                can_remove=sim.get("can_remove", False),
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
                        )

        # Convert UUID arrays to string arrays
        profile_ids = [str(pid) for pid in (row.get("profile_ids") or [])]
        simulation_ids = [str(sid) for sid in (row.get("simulation_ids") or [])]
        valid_simulation_ids = [
            str(sid) for sid in (row.get("valid_simulation_ids") or [])
        ]
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        # Convert mapping Pydantic instances to dictionaries for FastAPI serialization
        # FastAPI expects dict[str, dict] not dict[str, PydanticModel] for nested models
        simulation_mapping_dict = {
            k: v.model_dump() for k, v in simulation_mapping.items()
        }
        department_mapping_dict = {
            k: v.model_dump() for k, v in department_mapping.items()
        }

        response_data = CohortDetailResponse(
            title=row.get("title", ""),
            description=row.get("description"),
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            active=row.get("active", False),
            can_edit=row.get("can_edit", False),
            simulation_ids=simulation_ids,
            valid_simulation_ids=valid_simulation_ids,
            profile_ids=profile_ids,
            simulations=simulations,
            simulation_mapping=simulation_mapping_dict,
            department_mapping=department_mapping_dict,
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

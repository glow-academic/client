"""Cohort new endpoint - v3 API."""

import json
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

# Reuse models from detail.py
from app.api.v3.cohorts.detail import (
    CohortDetailResponse,
    CohortMappingItem,
    DepartmentMappingItem,
    ProfileMappingItem,
    SimulationInCohort,
    SimulationMappingItem,
    StaffItem,
)
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class CohortNewRequest(BaseModel):
    """Request for default cohort detail."""

    profileId: str


router = APIRouter()


@router.post("/new", response_model=CohortDetailResponse)
async def get_cohort_new(
    request_body: CohortNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailResponse:
    """Get default cohort detail with staff, simulations, and mappings."""
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
        sql_query = load_sql("sql/v3/cohorts/get_cohort_new_complete.sql")
        sql_params = (request_body.profileId,)
        row = await conn.fetchrow(sql_query, request_body.profileId)

        if not row:
            raise HTTPException(
                status_code=404, detail="No cohort found for user's departments"
            )

        # Parse simulations list from JSONB (same as detail.py)
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

        # Parse staff list from JSONB (same as detail.py)
        staff: list[StaffItem] = []
        if row.get("staff"):
            staff_data = row["staff"]
            if isinstance(staff_data, str):
                staff_data = json.loads(staff_data)
            if isinstance(staff_data, list):
                for s in staff_data:
                    if isinstance(s, dict):
                        last_active_val = s.get("lastActive")
                        last_active = (
                            last_active_val.isoformat()
                            if isinstance(last_active_val, datetime)
                            else None
                        )
                        # Get primary department_id - ensure it always exists (default to empty string or first department)
                        department_ids = s.get("department_ids", [])
                        primary_department_id = s.get("primary_department_id") or ""
                        if not primary_department_id and department_ids:
                            # Fallback to first department if no primary department set
                            primary_department_id = (
                                department_ids[0]
                                if isinstance(department_ids, list)
                                and len(department_ids) > 0
                                else ""
                            )

                        emails = s.get("emails") or []
                        primary_email = s.get("primaryEmail") or s.get("primary_email")
                        staff.append(
                            StaffItem(
                                profile_id=s.get("profile_id", ""),
                                first_name=s.get("first_name", ""),
                                last_name=s.get("last_name", ""),
                                emails=emails if isinstance(emails, list) else [],
                                primary_email=primary_email,
                                name=s.get("name", ""),
                                role=s.get("role", ""),
                                initials=s.get("initials", ""),
                                active=s.get("active", False),
                                lastActive=last_active,
                                cohort_ids=s.get("cohort_ids", []),
                                department_ids=department_ids,
                                primary_department_id=primary_department_id,
                                requests_per_day=s.get("requests_per_day"),
                                total_requests=s.get("total_requests", 0),
                                requests_in_last_day=s.get("requests_in_last_day", 0),
                                can_edit=s.get("can_edit", False),
                                can_delete=s.get("can_delete", False),
                                can_remove=s.get("can_remove", False),
                            )
                        )

        # Parse mappings (same as detail.py)
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        if row.get("simulation_mapping"):
            sim_map_data = row["simulation_mapping"]
            if isinstance(sim_map_data, str):
                sim_map_data = json.loads(sim_map_data)
            if isinstance(sim_map_data, dict):
                for sid, sdata in sim_map_data.items():
                    if isinstance(sdata, dict):
                        simulation_mapping[sid] = SimulationMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            time_limit=sdata.get("time_limit"),
                            department_ids=None,  # Not included in default query
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
        if row.get("cohort_mapping"):
            cohort_map_data = row["cohort_mapping"]
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

        # Get user role and primary department for default behavior
        user_role = row.get(
            "can_edit", False
        )  # This is a permission check, need to get role differently
        # Check if can_edit is False due to default object restriction
        dept_ids_from_row = row.get("department_ids")
        is_default_cohort = dept_ids_from_row is None or len(dept_ids_from_row) == 0

        # Get primary department from SQL result
        primary_department_id = row.get("primary_department_id")

        # For default cohorts, check role from can_edit logic
        # If can_edit is False and it's a default cohort, user is not superadmin
        # We need to infer role - check if it's a default object that can't be edited
        # For now, use a simpler approach: check if we have primary_department_id
        # If superadmin, they would have can_edit=True even for default objects
        # So if can_edit=False and is_default, user is not superadmin
        is_superadmin = not (is_default_cohort and not row.get("can_edit", False))

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            dept_ids = None
        else:
            dept_ids = [primary_department_id] if primary_department_id else []

        # Convert mapping Pydantic instances to dictionaries for FastAPI serialization
        # FastAPI expects dict[str, dict] not dict[str, PydanticModel] for nested models
        from typing import cast

        simulation_mapping_dict = cast(
            dict[str, dict[str, Any]],
            {k: v.model_dump() for k, v in simulation_mapping.items()},
        )
        profile_mapping_dict = cast(
            dict[str, dict[str, Any]],
            {k: v.model_dump() for k, v in profile_mapping.items()},
        )
        department_mapping_dict = cast(
            dict[str, dict[str, Any]],
            {k: v.model_dump() for k, v in department_mapping.items()},
        )
        cohort_mapping_dict = cast(
            dict[str, dict[str, Any]] | None,
            {k: v.model_dump() for k, v in cohort_mapping.items()}
            if cohort_mapping
            else None,
        )
        department_mapping_for_staff_dict = cast(
            dict[str, dict[str, Any]] | None,
            {k: v.model_dump() for k, v in department_mapping_for_staff.items()}
            if department_mapping_for_staff
            else None,
        )

        # MyPy type errors here are false positives - we convert Pydantic models to dicts via model_dump()
        # Runtime types are correct: dict[str, dict[str, Any]] which matches CohortDetailResponse expectations
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
            valid_profile_ids=valid_profile_ids,
            simulations=simulations,
            staff=staff,
            simulation_mapping=simulation_mapping_dict,  # type: ignore[arg-type]
            profile_mapping=profile_mapping_dict,  # type: ignore[arg-type]
            department_mapping=department_mapping_dict,  # type: ignore[arg-type]
            cohort_mapping=cohort_mapping_dict,  # type: ignore[arg-type]
            department_mapping_for_staff=department_mapping_for_staff_dict,  # type: ignore[arg-type]
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
            operation="get_cohort_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

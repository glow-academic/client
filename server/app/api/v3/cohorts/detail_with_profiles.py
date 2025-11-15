"""Cohort detail with profiles endpoint - v3 API."""

import json
import os
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

import uuid

from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import DepartmentMappingItem
from app.utils.sql_helper import load_sql

# Reuse StaffItem from detail.py
from app.api.v3.cohorts.detail import StaffItem


class CohortDetailWithProfilesRequest(BaseModel):
    """Request for cohort detail with available profiles."""

    cohortId: str
    departmentIds: list[str]
    currentProfileId: str


class CohortDetailWithProfilesResponse(BaseModel):
    """Response for cohort detail with available profiles."""

    cohort_id: str
    title: str
    description: str | None
    active: bool
    current_profile_ids: list[str]
    available_profiles: list[StaffItem]
    department_mapping: dict[str, DepartmentMappingItem]
    cohort_mapping: dict[str, dict[str, str]]  # Simplified cohort mapping


router = APIRouter()


@router.post("/detail-with-profiles", response_model=CohortDetailWithProfilesResponse)
async def get_cohort_detail_with_profiles(
    request_body: CohortDetailWithProfilesRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailWithProfilesResponse:
    """Get cohort detail with available profiles in one call."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return CohortDetailWithProfilesResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")
        sql_query = load_sql("sql/v3/cohorts/get_cohort_with_profiles_complete.sql")
        sql_params = (
            request_body.cohortId,
            [uuid.UUID(did) for did in request_body.departmentIds],
            request_body.currentProfileId,
            campus_domain,
        )
        row = await conn.fetchrow(
            sql_query,
            request_body.cohortId,
            [uuid.UUID(did) for did in request_body.departmentIds],
            request_body.currentProfileId,
            campus_domain,
        )

        if not row:
            raise HTTPException(status_code=404, detail="Cohort not found")

        # Parse available profiles from JSONB
        available_profiles: list[StaffItem] = []
        if row.get("available_profiles"):
            prof_data = row["available_profiles"]
            if isinstance(prof_data, str):
                prof_data = json.loads(prof_data)
            if isinstance(prof_data, list):
                for p in prof_data:
                    if isinstance(p, dict):
                        last_active_val = p.get("lastActive")
                        last_active = (
                            last_active_val.isoformat()
                            if (
                                last_active_val is not None
                                and isinstance(last_active_val, datetime)
                            )
                            else None
                        )
                        available_profiles.append(
                            StaffItem(
                                profile_id=p.get("profile_id", ""),
                                first_name=p.get("first_name", ""),
                                last_name=p.get("last_name", ""),
                                alias=p.get("alias", ""),
                                name=p.get("name", ""),
                                role=p.get("role", ""),
                                email=p.get("email", ""),
                                initials=p.get("initials", ""),
                                active=p.get("active", False),
                                lastActive=last_active,
                                cohort_ids=p.get("cohort_ids") or [],
                                department_ids=[],  # Not included in this query
                                requests_per_day=p.get("requests_per_day"),
                                total_requests=0,  # Not included in this query
                                default_profile=p.get("default_profile", False),
                                requests_in_last_day=p.get("requests_in_last_day", 0),
                                can_edit=p.get("can_edit", False),
                                can_delete=p.get("can_delete", False),
                                can_remove=False,  # Not included in this query
                            )
                        )

        # Parse department mapping
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if row.get("department_mapping"):
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

        # Build cohort mapping (just this cohort)
        cohort_mapping: dict[str, dict[str, str]] = {
            row["cohort_id"]: {
                "name": row["title"],
                "description": row["description"] or "",
            }
        }

        # Convert UUID arrays to string arrays
        current_profile_ids = [
            str(pid) for pid in (row.get("current_profile_ids") or [])
        ]

        response_data = CohortDetailWithProfilesResponse(
            cohort_id=row["cohort_id"],
            title=row["title"],
            description=row["description"],
            active=row["active"],
            current_profile_ids=current_profile_ids,
            available_profiles=available_profiles,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
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
            operation="get_cohort_detail_with_profiles",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

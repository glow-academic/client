"""Staff detail endpoint - get detailed profile information (staff version with permissions)."""

import json
import os
from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class StaffDetailRequest(BaseModel):
    """Request for staff detail."""

    profileId: str
    currentProfileId: str  # For permissions/validation


class StaffDetailResponse(BaseModel):
    """Response for staff detail endpoint."""

    # Basic fields
    name: str
    email: str
    role: str
    requests_per_day: int | None
    active: bool
    department_id: str
    valid_department_ids: list[str]
    cohort_ids: list[str]

    # Metadata
    role_options: list[str]

    # Top-level mappings
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


@router.post("/detail", response_model=StaffDetailResponse)
async def get_profile_detail_staff(
    request: StaffDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailResponse:
    """Get detailed profile information (staff version with permissions)."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get campus email domain from environment
        campus_email = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")

        # Get complete profile data with JSONB mappings (consolidated query)
        sql_query = load_sql("sql/v3/profile/staff/get_staff_detail_complete.sql")
        sql_params = (request.profileId,)
        profile = await conn.fetchrow(sql_query, request.profileId)

        if not profile:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        # Construct email
        email = profile["alias"] + campus_email

        # Parse data from consolidated query
        department_id = profile["department_id"]
        cohort_ids = profile["cohort_ids"] or []

        # Parse JSONB cohort mapping (may be string or dict)
        cohort_mapping = {}
        cohort_mapping_data = profile.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse valid departments from consolidated query
        valid_department_ids = profile.get("valid_department_ids") or []
        valid_department_ids = [str(did) for did in valid_department_ids]

        # Parse department mapping from consolidated query
        department_mapping = {}
        dept_mapping_data = profile.get("department_mapping_full")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        response_data = StaffDetailResponse(
            name=profile["name"],
            email=email,
            role=profile["role"],
            requests_per_day=profile["requests_per_day"],
            active=profile["active"],
            department_id=department_id,
            valid_department_ids=valid_department_ids,
            cohort_ids=cohort_ids,
            role_options=role_options,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
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
            route_path=http_request.url.path,
            operation="get_staff_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

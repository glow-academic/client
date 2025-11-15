"""Staff detail bulk endpoint - get bulk profile detail information."""

import json
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMappingItem
from app.utils.sql_helper import load_sql

router = APIRouter()


class StaffDetailBulkRequest(BaseModel):
    """Request for staff detail bulk."""

    profileIds: list[str]
    currentProfileId: str


class StaffDetailBulkResponse(BaseModel):
    """Response for staff detail bulk endpoint."""

    # Common editable fields across selected profiles
    role: str | None  # null if mixed
    requests_per_day: int | None  # null if mixed
    department_ids: list[str]
    valid_department_ids: list[str]

    # Metadata
    role_options: list[str]

    # Top-level mappings
    department_mapping: dict[str, DepartmentMappingItem]


@router.post("/detail-bulk", response_model=StaffDetailBulkResponse)
async def get_profile_detail_bulk(
    request: StaffDetailBulkRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailBulkResponse:
    """Get bulk profile detail information."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffDetailBulkResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profiles with JSONB department mapping (consolidated query)
        sql_query = load_sql("sql/v3/profile/staff/get_profiles_by_ids.sql")
        sql_params = (request.profileIds,)
        profiles = await conn.fetch(sql_query, request.profileIds)

        if not profiles:
            raise HTTPException(status_code=404, detail="No profiles found")

        # Check if roles are consistent
        roles = list({p["role"] for p in profiles})
        role = roles[0] if len(roles) == 1 else None

        # Check if requests_per_day are consistent
        req_per_days = list(
            {

                    p["requests_per_day"]
                    for p in profiles
                    if p["requests_per_day"] is not None

            }
        )
        requests_per_day = req_per_days[0] if len(req_per_days) == 1 else None

        # Get all department_ids from optimized query result
        all_dept_ids: list[str] = []
        for p in profiles:
            dept_ids = p.get("department_ids") or []
            all_dept_ids.extend(dept_ids)
        department_ids = list(set(all_dept_ids))

        # Parse JSONB department mapping from query result (may be string or dict)
        department_mapping = {}
        if profiles and len(profiles) > 0:
            dept_mapping_data = profiles[0].get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Parse valid departments from consolidated query
        valid_department_ids = []
        if profiles and len(profiles) > 0:
            valid_dept_ids_raw = profiles[0].get("valid_department_ids") or []
            valid_department_ids = [str(did) for did in valid_dept_ids_raw]

            # Update department_mapping to use department_mapping_full
            dept_mapping_full = profiles[0].get("department_mapping_full")
            if isinstance(dept_mapping_full, str):
                dept_mapping_full = json.loads(dept_mapping_full)
            if dept_mapping_full and isinstance(dept_mapping_full, dict):
                # Override with full department mapping
                department_mapping = {}
                for did, ddata in dept_mapping_full.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        response_data = StaffDetailBulkResponse(
            role=role,
            requests_per_day=requests_per_day,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            role_options=role_options,
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
            operation="get_profile_detail_bulk",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

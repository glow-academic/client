"""Staff detail endpoint - get individual staff profile details with role visibility check."""

import json
from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class StaffDetailRequest(BaseModel):
    """Request for staff detail."""

    profileId: str  # Target profile to get details for
    currentProfileId: str  # Current user's profile ID for role visibility check


class StaffDetailResponse(BaseModel):
    """Response for staff detail endpoint."""

    profile_id: str
    first_name: str
    last_name: str
    name: str
    emails: list[str]  # List of all active emails
    primary_email: str | None  # Primary email (first in emails array if exists)
    role: str
    requests_per_day: int | None
    primary_department_id: str | None
    active: bool
    default_profile: bool
    can_edit: bool
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/detail", response_model=StaffDetailResponse)
async def get_staff_detail(
    request_body: StaffDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailResponse:
    """Get staff profile details with role visibility check."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql("sql/v3/profile/staff/get_staff_detail.sql")
        sql_params = (
            request_body.profileId,
            request_body.currentProfileId,
        )

        # Execute query
        row = await conn.fetchrow(
            sql_query, request_body.profileId, request_body.currentProfileId
        )

        # If no row returned, profile is not visible to current user (role hierarchy)
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Profile {request_body.profileId} not found or not visible",
            )

        # Build response
        emails = row.get("emails") or []
        primary_email = row.get("primary_email")
        
        # Parse department_mapping
        department_mapping_data = parse_jsonb(row.get("department_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )
        
        valid_department_ids = row.get("valid_department_ids") or []
        if not isinstance(valid_department_ids, list):
            valid_department_ids = []
        
        # Handle primary_department_id - convert to string if not None
        primary_department_id = row.get("primary_department_id")
        if primary_department_id is not None:
            primary_department_id = str(primary_department_id)
        
        response_data = StaffDetailResponse(
            profile_id=str(row.get("profile_id", "")),
            first_name=row.get("first_name", ""),
            last_name=row.get("last_name", ""),
            name=row.get("name", ""),
            emails=emails if isinstance(emails, list) else [],
            primary_email=primary_email,
            role=row.get("role", ""),
            requests_per_day=row.get("requests_per_day"),
            primary_department_id=primary_department_id,
            active=row.get("active", True),
            default_profile=row.get("default_profile", False),
            can_edit=row.get("can_edit", False),
            valid_department_ids=valid_department_ids,
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
            route_path=request.url.path,
            operation="get_staff_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )


"""Department detail endpoint - v3 API."""

import json
import os
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class DepartmentDetailRequest(BaseModel):
    """Request for department detail."""

    departmentId: str
    profileId: str


class StaffItem(BaseModel):
    """Staff item from department detail."""

    profile_id: str
    first_name: str
    last_name: str
    alias: str
    name: str
    role: str
    email: str
    initials: str
    active: bool
    last_active: str | None = None
    cohort_ids: list[str] = []
    department_ids: list[str] = []
    primary_department_id: str  # Primary department ID (for editing)
    requests_per_day: int | None = None
    total_requests: int = 0
    default_profile: bool
    intro_completed: bool = False
    chat_completed: bool = False
    requests_in_last_day: int = 0
    can_edit: bool
    can_delete: bool


class DepartmentDetailResponse(BaseModel):
    """Response for department detail."""

    title: str
    description: str
    active: bool
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    in_use: bool
    staff_count: int
    total_price_spent: float
    staff: list[StaffItem]
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    valid_department_ids: list[str]


router = APIRouter()


@router.post("/detail", response_model=DepartmentDetailResponse)
async def get_department_detail(
    request_body: DepartmentDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get department detail with permissions, stats, and staff list."""
    tags = ["departments"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DepartmentDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")
        sql_query = load_sql("sql/v3/departments/get_department_detail_with_staff.sql")
        sql_params = (request_body.departmentId, request_body.profileId, campus_domain)
        dept_row = await conn.fetchrow(
            sql_query, request_body.departmentId, request_body.profileId, campus_domain
        )

        if not dept_row:
            raise HTTPException(
                status_code=404,
                detail=f"Department {request_body.departmentId} not found",
            )

        # Parse staff list from JSONB
        staff_list: list[StaffItem] = []
        staff_data = dept_row.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for staff_row in staff_data:
                if isinstance(staff_row, dict):
                    cohort_ids = [
                        str(cid) for cid in (staff_row.get("cohort_ids") or [])
                    ]
                    department_ids = staff_row.get("department_ids") or []
                    # Get primary department_id - ensure it always exists (default to empty string or first department)
                    primary_department_id = staff_row.get("primary_department_id") or ""
                    if not primary_department_id and department_ids:
                        # Fallback to first department if no primary department set
                        primary_department_id = department_ids[0] if isinstance(department_ids, list) and len(department_ids) > 0 else ""

                    last_active = None
                    if staff_row.get("lastActive"):
                        last_active_val = staff_row["lastActive"]
                        if isinstance(last_active_val, str):
                            last_active = last_active_val
                        elif hasattr(last_active_val, "isoformat"):
                            last_active = last_active_val.isoformat()
                        else:
                            last_active = str(last_active_val)

                    staff_list.append(
                        StaffItem(
                            profile_id=str(staff_row["profile_id"]),
                            first_name=staff_row["first_name"],
                            last_name=staff_row["last_name"],
                            alias=staff_row["alias"],
                            name=staff_row["name"],
                            role=staff_row["role"],
                            email=staff_row["email"],
                            initials=staff_row["initials"],
                            active=staff_row["active"],
                            last_active=last_active,
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            primary_department_id=primary_department_id,
                            requests_per_day=staff_row.get("requests_per_day"),
                            total_requests=staff_row.get("total_requests", 0),
                            default_profile=staff_row["default_profile"],
                            intro_completed=staff_row.get("intro_completed", False),
                            chat_completed=staff_row.get("chat_completed", False),
                            requests_in_last_day=staff_row.get(
                                "requests_in_last_day", 0
                            ),
                            can_edit=staff_row["can_edit"],
                            can_delete=staff_row["can_delete"],
                        )
                    )

        # Parse cohort mapping from JSONB
        cohort_mapping = {}
        cohort_mapping_data = dept_row.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse department mapping from JSONB
        department_mapping = {}
        dept_mapping_data = dept_row.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Get valid_department_ids from department_mapping keys
        valid_department_ids = list(department_mapping.keys())

        response_data = DepartmentDetailResponse(
            title=dept_row["title"],
            description=dept_row["description"],
            active=dept_row["active"],
            can_edit=dept_row["can_edit"],
            can_duplicate=dept_row["can_duplicate"],
            can_delete=dept_row["can_delete"],
            in_use=dept_row["in_use"],
            staff_count=int(dept_row["staff_count"]),
            total_price_spent=float(dept_row["total_price_spent"]),
            staff=staff_list,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
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
            operation="get_department_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

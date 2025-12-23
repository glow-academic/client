"""Staff create data endpoint - get all data needed for create staff UI."""

import json
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.staff.list import StaffItem
from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


router = APIRouter()


class CreateStaffDataRequest(BaseModel):
    """Request for create staff data (mappings, etc.)."""

    departmentIds: list[str]
    # profileId removed - comes from X-Profile-Id header


class CreateStaffDataResponse(BaseModel):
    """Response with all data needed for create staff UI."""

    staff: list[StaffItem]
    department_mapping: dict[str, DepartmentMappingItem]
    cohort_mapping: dict[str, CohortMappingItem]
    role_options: list[str]


@router.post(
    "/data/create",
    response_model=CreateStaffDataResponse,
    dependencies=[
        audit_activity("staff.data", "{{ actor.name }} viewed staff create data")
    ],
)
async def get_create_staff_data(
    request: CreateStaffDataRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateStaffDataResponse:
    """Get all data needed for create staff UI (mappings, etc.)."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return CreateStaffDataResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/profile/staff/get_create_staff_data.sql")
        sql_params = (request.departmentIds, profile_id)
        result = await conn.fetchrow(sql_query, request.departmentIds, profile_id)

        if not result:
            # Return empty mappings if no data
            return CreateStaffDataResponse(
                staff=[],
                department_mapping={},
                cohort_mapping={},
                role_options=[
                    "superadmin",
                    "admin",
                    "instructional",
                    "member",
                    "guest",
                ],
            )

        # Parse staff JSONB array
        staff = []
        staff_data = result.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for item in staff_data:
                if isinstance(item, dict):
                    # Convert UUID arrays to string arrays
                    cohort_ids = [str(cid) for cid in (item.get("cohort_ids") or [])]
                    department_ids = item.get("department_ids") or []
                    # Get primary department_id - ensure it always exists (default to empty string or first department)
                    primary_department_id = item.get("primary_department_id") or ""
                    if not primary_department_id and department_ids:
                        # Fallback to first department if no primary department set
                        primary_department_id = (
                            department_ids[0] if len(department_ids) > 0 else ""
                        )

                    emails = item.get("emails") or []
                    primary_email = item.get("primary_email")
                    staff.append(
                        StaffItem(
                            profile_id=str(item.get("profile_id", "")),
                            first_name=item.get("first_name", ""),
                            last_name=item.get("last_name", ""),
                            emails=emails if isinstance(emails, list) else [],
                            primary_email=primary_email,
                            name=item.get("name", ""),
                            role=item.get("role", ""),
                            initials="",  # Not needed for search modal
                            active=item.get("active", False),
                            last_active=item.get("last_active"),
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            primary_department_id=primary_department_id,
                            requests_per_day=item.get("requests_per_day"),
                            total_requests=item.get("total_requests", 0),
                            requests_in_last_day=item.get("requests_in_last_day", 0),
                            can_edit=False,  # Not needed for search modal
                            can_delete=False,  # Not needed for search modal
                        )
                    )

        # Parse JSONB mappings
        department_mapping = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        cohort_mapping = {}
        cohort_mapping_data = result.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        response_data = CreateStaffDataResponse(
            staff=staff,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
            role_options=["superadmin", "admin", "instructional", "ta", "guest"],
        )

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

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
            operation="get_create_staff_data",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

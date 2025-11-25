"""Staff list endpoint - get staff list with permissions and relationships."""

import json
import os
from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (CohortMappingItem, DepartmentMappingItem,
                              TrendData)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class StaffFilters(BaseModel):
    """Filters for staff list."""

    profileId: str  # Current user's profile for permissions


class StaffItem(BaseModel):
    """Staff item in list response."""

    profile_id: str
    first_name: str
    last_name: str
    emails: list[str]  # List of all active emails
    primary_email: str | None  # Primary email (first in emails array if exists)
    name: str  # Combined first_name + last_name
    role: str
    initials: str  # Derived from first_name + last_name
    active: bool
    last_active: str | None
    cohort_ids: list[str]
    department_ids: list[str]
    primary_department_id: str  # Primary department ID (for editing)
    requests_per_day: int | None
    total_requests: int
    default_profile: bool
    requests_in_last_day: int
    can_edit: bool
    can_delete: bool


class StaffListResponse(BaseModel):
    """Response for staff list endpoint."""

    staff: list[StaffItem]
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    valid_department_ids: list[str]  # All valid department IDs (for editing)
    trend_data: dict[
        str, list[TrendData]
    ]  # Keys: active, admin, instructional, ta, total_requests
    # UI-ready facet options (precomputed on server)
    role_options: list[dict[str, str]]  # Array of {value, label}
    cohort_options: list[dict[str, str]]  # Array of {value, label}
    last_active_options: list[dict[str, str]]  # Array of {value, label}


@router.post("/list", response_model=StaffListResponse)
async def get_profile_list(
    filters: StaffFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffListResponse:
    """Get profile/staff list with permissions and relationships."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string (includes current user role in result)
        sql_query = load_sql("sql/v3/profile/staff/list_staff.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Get current user's role from first row (same for all rows)
        current_user_role = (
            result[0]["current_user_role"] if result and len(result) > 0 else "guest"
        )

        # Build response
        staff = []
        cohort_mapping = {}
        department_mapping = {}
        trend_data: dict[str, list[TrendData]] = {
            "active": [],
            "admin": [],
            "instructional": [],
            "ta": [],
            "total_requests": [],
        }

        # Get valid_department_ids from first row (same for all rows)
        valid_department_ids = []
        if result and len(result) > 0:
            valid_dept_ids_raw = result[0].get("valid_department_ids") or []
            valid_department_ids = [str(did) for did in valid_dept_ids_raw]

        for row in result:
            # Convert UUID arrays to string arrays
            cohort_ids = [str(cid) for cid in (row["cohort_ids"] or [])]
            # Convert UUID arrays to string arrays (department_ids comes as text[] from query)
            department_ids = row["department_ids"] or []
            # Get primary department_id - ensure it always exists (default to empty string or first department)
            primary_department_id = row.get("primary_department_id") or ""
            if not primary_department_id and department_ids:
                # Fallback to first department if no primary department set
                primary_department_id = department_ids[0] if isinstance(department_ids, list) and len(department_ids) > 0 else ""

            emails = row.get("emails") or []
            primary_email = row.get("primary_email")
            staff.append(
                StaffItem(
                    profile_id=str(row["profile_id"]),
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    emails=emails if isinstance(emails, list) else [],
                    primary_email=primary_email,
                    name=row["name"],
                    role=row["role"],
                    initials=row["initials"],
                    active=row["active"],
                    last_active=row["lastactive"].isoformat()
                    if row["lastactive"]
                    else None,
                    cohort_ids=cohort_ids,
                    department_ids=department_ids,
                    primary_department_id=primary_department_id,
                    requests_per_day=row["requests_per_day"],
                    total_requests=row["total_requests"] or 0,
                    default_profile=row["default_profile"],
                    requests_in_last_day=row["requests_in_last_day"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Parse JSONB mappings from query result (single query optimization)
        if result and len(result) > 0:
            # Cohort mapping (JSONB from query - may be string or dict)
            cohort_mapping_data = result[0].get("cohort_mapping")
            if isinstance(cohort_mapping_data, str):
                cohort_mapping_data = json.loads(cohort_mapping_data)
            if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
                for cid, cdata in cohort_mapping_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

            # Department mapping (JSONB from query - may be string or dict)
            dept_mapping_data = result[0].get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

            # Trend data (JSONB from query - may be string or dict)
            trend_data_raw = result[0].get("trend_data")
            if isinstance(trend_data_raw, str):
                trend_data_raw = json.loads(trend_data_raw)
            if trend_data_raw and isinstance(trend_data_raw, dict):
                for key in ["active", "admin", "instructional", "ta", "total_requests"]:
                    trend_array = trend_data_raw.get(key, [])
                    if isinstance(trend_array, list):
                        trend_data[key] = [
                            TrendData(
                                date=str(item.get("date", "")),
                                value=float(item.get("value", 0)),
                                count=int(item.get("count", 0)),
                            )
                            for item in trend_array
                            if isinstance(item, dict)
                        ]

        # Build filter options
        # Role options based on current user's role
        role_options = []
        if current_user_role == "superadmin":
            role_options = [
                {"value": "superadmin", "label": "Super Administrator"},
                {"value": "admin", "label": "Administrator"},
                {"value": "instructional", "label": "Instructional Staff"},
                {"value": "ta", "label": "Teaching Assistant"},
                {"value": "guest", "label": "Guest"},
            ]
        elif current_user_role == "admin":
            role_options = [
                {"value": "admin", "label": "Administrator"},
                {"value": "instructional", "label": "Instructional Staff"},
                {"value": "ta", "label": "Teaching Assistant"},
                {"value": "guest", "label": "Guest"},
            ]
        else:
            role_options = [
                {"value": "instructional", "label": "Instructional Staff"},
                {"value": "ta", "label": "Teaching Assistant"},
                {"value": "guest", "label": "Guest"},
            ]

        # Cohort options from cohort_mapping
        cohort_options = [
            {"value": cid, "label": item.name} for cid, item in cohort_mapping.items()
        ]

        # Last active options (static)
        last_active_options = [
            {"value": "recent", "label": "Recently Active (< 7 days)"},
            {"value": "moderate", "label": "Moderately Active (7-30 days)"},
            {"value": "old", "label": "Inactive (> 30 days)"},
            {"value": "never", "label": "Never Active"},
        ]

        response_data = StaffListResponse(
            staff=staff,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
            trend_data=trend_data,
            role_options=role_options,
            cohort_options=cohort_options,
            last_active_options=last_active_options,
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
            operation="get_staff_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

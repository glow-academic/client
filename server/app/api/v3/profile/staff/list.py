"""Staff list endpoint - get staff list with permissions and relationships."""

import json
import os
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import (CohortMappingItem, DepartmentMappingItem,
                              TrendData)
from app.utils.sql_helper import load_sql

router = APIRouter()


class StaffFilters(BaseModel):
    """Filters for staff list."""

    profileId: str  # Current user's profile for permissions


class StaffItem(BaseModel):
    """Staff item in list response."""

    profile_id: str
    first_name: str
    last_name: str
    alias: str
    name: str  # Combined first_name + last_name
    role: str
    email: str  # alias + campus email domain
    initials: str  # Derived from first_name + last_name
    active: bool
    last_active: str | None
    cohort_ids: list[str]
    department_ids: list[str]
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
    trend_data: dict[str, list[TrendData]]  # Keys: active, admin, instructional, ta, total_requests


@router.post("/list")
async def get_profile_list(
    filters: StaffFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffListResponse:
    """Get profile/staff list with permissions and relationships."""
    try:
        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Load SQL string
        sql = load_sql("sql/v3/profile/staff/list_staff.sql")

        # Execute query
        result = await conn.fetch(sql, filters.profileId, campus_domain)

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

        for row in result:
            # Convert UUID arrays to string arrays
            cohort_ids = [str(cid) for cid in (row["cohort_ids"] or [])]
            # Convert UUID arrays to string arrays (department_ids comes as text[] from query)
            department_ids = row["department_ids"] or []

            staff.append(
                StaffItem(
                    profile_id=str(row["profile_id"]),
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    alias=row["alias"],
                    name=row["name"],
                    role=row["role"],
                    email=row["email"],
                    initials=row["initials"],
                    active=row["active"],
                    last_active=row["lastactive"].isoformat()
                    if row["lastactive"]
                    else None,
                    cohort_ids=cohort_ids,
                    department_ids=department_ids,
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

        return StaffListResponse(
            staff=staff,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
            trend_data=trend_data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


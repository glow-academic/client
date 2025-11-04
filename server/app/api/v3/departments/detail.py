"""Department detail endpoint - v3 API."""

import json
import os
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql


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
    requests_per_day: int | None = None
    total_requests: int = 0
    default_profile: bool
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


router = APIRouter()


@router.post("/detail")
async def get_department_detail(
    request: DepartmentDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get department detail with permissions, stats, and staff list."""
    try:
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")
        sql = load_sql("sql/v3/departments/get_department_detail_with_staff.sql")
        dept_row = await conn.fetchrow(sql, request.departmentId, request.profileId, campus_domain)

        if not dept_row:
            raise HTTPException(status_code=404, detail=f"Department {request.departmentId} not found")

        # Parse staff list from JSONB
        staff_list: list[StaffItem] = []
        staff_data = dept_row.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for staff_row in staff_data:
                if isinstance(staff_row, dict):
                    cohort_ids = [str(cid) for cid in (staff_row.get("cohort_ids") or [])]
                    department_ids = staff_row.get("department_ids") or []
                    
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
                            requests_per_day=staff_row.get("requests_per_day"),
                            total_requests=staff_row.get("total_requests", 0),
                            default_profile=staff_row["default_profile"],
                            requests_in_last_day=staff_row.get("requests_in_last_day", 0),
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

        return DepartmentDetailResponse(
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
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


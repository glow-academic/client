"""Staff create staff data endpoint - get all data needed for create staff UI."""

import json
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v3.profile.staff.list import StaffItem
from app.db import get_db
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql

router = APIRouter()


class CreateStaffDataRequest(BaseModel):
    """Request for create staff data (mappings, etc.)."""

    departmentIds: list[str]
    profileId: str  # Current user's profile for permissions


class CreateStaffDataResponse(BaseModel):
    """Response with all data needed for create staff UI."""

    staff: list[StaffItem]
    department_mapping: dict[str, DepartmentMappingItem]
    cohort_mapping: dict[str, CohortMappingItem]
    role_options: list[str]


@router.post("/create-staff-data")
async def get_create_staff_data(
    request: CreateStaffDataRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateStaffDataResponse:
    """Get all data needed for create staff UI (mappings, etc.)."""
    try:
        sql = load_sql("sql/v3/profile/staff/get_create_staff_data.sql")
        result = await conn.fetchrow(sql, request.departmentIds, request.profileId)

        if not result:
            # Return empty mappings if no data
            return CreateStaffDataResponse(
                staff=[],
                department_mapping={},
                cohort_mapping={},
                role_options=["superadmin", "admin", "instructional", "ta", "guest"],
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
                    
                    staff.append(
                        StaffItem(
                            profile_id=str(item.get("profile_id", "")),
                            first_name=item.get("first_name", ""),
                            last_name=item.get("last_name", ""),
                            alias=item.get("alias", ""),
                            name=item.get("name", ""),
                            role=item.get("role", ""),
                            email="",  # Not needed for search modal
                            initials="",  # Not needed for search modal
                            active=item.get("active", False),
                            last_active=item.get("last_active"),
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            requests_per_day=item.get("requests_per_day"),
                            total_requests=item.get("total_requests", 0),
                            default_profile=item.get("default_profile", False),
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

        return CreateStaffDataResponse(
            staff=staff,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
            role_options=["superadmin", "admin", "instructional", "ta", "guest"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


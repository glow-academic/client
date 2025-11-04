"""Department list endpoint - v3 API."""

import json
import os
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql
from app.utils.schema import CohortMappingItem, DepartmentMappingItem


class DepartmentsListRequest(BaseModel):
    """Request for departments list."""

    profileId: str


class DepartmentItem(BaseModel):
    """Department item for list view."""

    department_id: str
    title: str
    description: str
    active: bool
    updated_at: str
    total_price_spent: float
    staff_count: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class DepartmentsListResponse(BaseModel):
    """Response for departments list."""

    departments: list[DepartmentItem]


router = APIRouter()


@router.post("/list")
async def get_departments_list(
    request: DepartmentsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentsListResponse:
    """Get list of departments with computed fields."""
    try:
        sql = load_sql("sql/v3/departments/get_departments_list.sql")
        rows = await conn.fetch(sql, request.profileId)

        departments = []
        for row in rows:
            departments.append(
                DepartmentItem(
                    department_id=row["department_id"],
                    title=row["title"],
                    description=row["description"],
                    active=row["active"],
                    updated_at=row["updated_at"].isoformat(),
                    total_price_spent=float(row["total_price_spent"]),
                    staff_count=int(row["staff_count"]),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        return DepartmentsListResponse(departments=departments)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


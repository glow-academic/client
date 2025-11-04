"""Department duplicate endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql


class DuplicateDepartmentRequest(BaseModel):
    """Request for duplicating a department."""

    departmentId: str


class DuplicateDepartmentResponse(BaseModel):
    """Response for duplicating a department."""

    success: bool
    departmentId: str
    message: str


router = APIRouter()


@router.post("/duplicate")
async def duplicate_department(
    request: DuplicateDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentResponse:
    """Duplicate a department."""
    try:
        # Get original department title
        basic_sql = load_sql("sql/v3/departments/get_department_basic.sql")
        dept_row = await conn.fetchrow(basic_sql, request.departmentId)

        if not dept_row:
            raise HTTPException(status_code=404, detail=f"Department {request.departmentId} not found")

        new_title = f"{dept_row['title']} Copy"

        async with transaction(conn):
            sql = load_sql("sql/v3/departments/duplicate_department.sql")
            new_dept_row = await conn.fetchrow(sql, request.departmentId, new_title)

            if not new_dept_row:
                raise HTTPException(status_code=500, detail="Failed to duplicate department")

            new_department_id = new_dept_row["department_id"]

        return DuplicateDepartmentResponse(
            success=True,
            departmentId=new_department_id,
            message="Department duplicated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


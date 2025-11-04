"""Department update endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql


class UpdateDepartmentRequest(BaseModel):
    """Request for updating a department."""

    departmentId: str
    title: str
    description: str
    active: bool


class UpdateDepartmentResponse(BaseModel):
    """Response for updating a department."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update")
async def update_department(
    request: UpdateDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDepartmentResponse:
    """Update a department."""
    try:
        async with transaction(conn):
            sql = load_sql("sql/v3/departments/update_department.sql")
            await conn.execute(sql, request.departmentId, request.title, request.description, request.active)

        return UpdateDepartmentResponse(
            success=True,
            message="Department updated successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


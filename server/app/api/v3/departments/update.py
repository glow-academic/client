"""Department update endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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


@router.post("/update", response_model=UpdateDepartmentResponse)
async def update_department(
    request: UpdateDepartmentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDepartmentResponse:
    """Update a department."""
    tags = ["departments"]  # From router tags
    
    try:
        async with transaction(conn):
            sql = load_sql("sql/v3/departments/update_department.sql")
            await conn.execute(sql, request.departmentId, request.title, request.description, request.active)

        result = UpdateDepartmentResponse(
            success=True,
            message="Department updated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


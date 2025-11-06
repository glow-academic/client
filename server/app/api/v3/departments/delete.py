"""Department delete endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


class DeleteDepartmentRequest(BaseModel):
    """Request for deleting a department."""

    departmentId: str


class DeleteDepartmentResponse(BaseModel):
    """Response for deleting a department."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteDepartmentResponse)
async def delete_department(
    request: DeleteDepartmentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDepartmentResponse:
    """Delete a department (with usage check)."""
    tags = ["departments"]  # From router tags
    
    try:
        # Delete department with existence and usage checks in a single SQL file
        sql = load_sql("sql/v3/departments/delete_department_complete.sql")
        result = await conn.fetchrow(sql, request.departmentId)

        if not result:
            # Department doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Department {request.departmentId} not found"
            )

        # Check if department was deleted or is in use
        if not result["deleted"]:
            # Department exists but is in use
            total_usage = result["total_usage"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete department: in use by {total_usage} entities",
            )

        result = DeleteDepartmentResponse(
            success=True,
            message="Department deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


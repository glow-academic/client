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
        # Check if department is in use
        usage_sql = load_sql("sql/v3/departments/check_department_usage.sql")
        usage_row = await conn.fetchrow(usage_sql, request.departmentId)

        if not usage_row:
            raise HTTPException(status_code=404, detail=f"Department {request.departmentId} not found")

        # Only count actual data dependencies
        total_usage = (
            usage_row["simulation_count"]
            + usage_row["scenario_count"]
            + usage_row["persona_count"]
            + usage_row["document_count"]
            + usage_row["cohort_count"]
        )

        if total_usage > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete department: in use by {total_usage} entities",
            )

        # Delete department
        sql = load_sql("sql/v3/departments/delete_department.sql")
        await conn.execute(sql, request.departmentId)

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


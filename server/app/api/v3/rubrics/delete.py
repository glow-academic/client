"""Rubric delete endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class DeleteRubricRequest(BaseModel):
    """Request for deleting a rubric."""

    rubricId: str


class DeleteRubricResponse(BaseModel):
    """Response for deleting a rubric."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteRubricResponse)
async def delete_rubric(
    request: DeleteRubricRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricResponse:
    """Delete a rubric."""
    tags = ["rubrics"]  # From router tags
    
    try:
        # Delete rubric with existence and usage checks in a single SQL file
        sql = load_sql("sql/v3/rubrics/delete_rubric_complete.sql")
        result = await conn.fetchrow(sql, request.rubricId)

        if not result:
            # Rubric doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Rubric {request.rubricId} not found"
            )

        # Check if rubric was deleted or is in use
        if not result["deleted"]:
            # Rubric exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete rubric: in use by {usage_count} simulation(s)",
            )

        result_data = DeleteRubricResponse(
            success=True,
            message="Rubric deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


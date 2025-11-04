"""Rubric delete endpoint - v3 API."""

import uuid
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
        # Check usage
        usage_sql = load_sql("sql/v3/rubrics/check_rubric_usage.sql")
        usage_row = await conn.fetchrow(usage_sql, uuid.UUID(request.rubricId))

        if usage_row and usage_row["usage_count"] > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete rubric: in use by {usage_row['usage_count']} simulation(s)",
            )

        # Delete rubric (cascade deletes standard_groups and standards)
        sql = load_sql("sql/v3/rubrics/delete_rubric.sql")
        await conn.execute(sql, uuid.UUID(request.rubricId))

        result = DeleteRubricResponse(
            success=True,
            message="Rubric deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


"""Rubric duplicate endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class DuplicateRubricRequest(BaseModel):
    """Request for duplicating a rubric."""

    rubricId: str


class DuplicateRubricResponse(BaseModel):
    """Response for duplicating a rubric."""

    success: bool
    rubricId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateRubricResponse)
async def duplicate_rubric(
    request: DuplicateRubricRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricResponse:
    """Duplicate a rubric with entire hierarchy."""
    tags = ["rubrics"]  # From router tags
    
    try:
        # Duplicate rubric with departments, standard groups, and standards in a single SQL file
        sql = load_sql("sql/v3/rubrics/duplicate_rubric_complete.sql")
        row = await conn.fetchrow(sql, request.rubricId)

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        rubric_id = row["rubric_id"]

        # Get original rubric name for message
        original_rubric = await conn.fetchrow(
            "SELECT name FROM rubrics WHERE id = $1",
            request.rubricId,
        )
        original_name = original_rubric["name"] if original_rubric else "Rubric"

        result = DuplicateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message=f"Rubric '{original_name}' duplicated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


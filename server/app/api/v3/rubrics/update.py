"""Rubric update endpoint - v3 API."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class StandardItem(BaseModel):
    """Standard item for update."""

    name: str
    description: str | None = None
    points: int


class StandardGroupItem(BaseModel):
    """Standard group item for update."""

    name: str
    short_name: str | None = None
    description: str | None = None
    points: int
    passPoints: int
    standards: list[StandardItem] = []


class UpdateRubricRequest(BaseModel):
    """Request for updating a rubric."""

    rubricId: str
    name: str
    description: str | None = None
    active: bool
    points: int
    passPoints: int
    department_ids: list[str] = []
    standard_groups: list[StandardGroupItem] = []


class UpdateRubricResponse(BaseModel):
    """Response for updating a rubric."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateRubricResponse)
async def update_rubric(
    request: UpdateRubricRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateRubricResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
    tags = ["rubrics"]  # From router tags
    
    try:
        # Convert standard groups to JSONB array for SQL
        standard_groups_json = json.dumps([
            {
                "name": group.name,
                "short_name": group.short_name,
                "description": group.description,
                "points": group.points,
                "passPoints": group.passPoints,
                "standards": [
                    {
                        "name": standard.name,
                        "description": standard.description,
                        "points": standard.points,
                    }
                    for standard in group.standards
                ]
            }
            for group in request.standard_groups
        ])

        # Ensure department_ids is always an array (empty if None)
        department_ids = request.department_ids if request.department_ids else []

        # Update rubric with departments, standard groups, and standards in a single SQL file
        sql = load_sql("sql/v3/rubrics/update_rubric_complete.sql")
        row = await conn.fetchrow(
            sql,
            request.rubricId,
            request.name,
            request.description,
            request.active,
            request.points,
            request.passPoints,
            department_ids,
            standard_groups_json,
        )

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        result = UpdateRubricResponse(
            success=True,
            message="Rubric updated successfully",
        )
        
        # Invalidate cache after mutation (both list and individual rubric)
        all_tags = tags + [f"rubric:{request.rubricId}"]
        await invalidate_tags(all_tags)
        response.headers["X-Invalidate-Tags"] = ",".join(all_tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


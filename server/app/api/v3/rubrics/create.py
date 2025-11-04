"""Rubric create endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class StandardItem(BaseModel):
    """Standard item for create."""

    name: str
    description: str | None = None
    points: int


class StandardGroupItem(BaseModel):
    """Standard group item for create."""

    name: str
    short_name: str | None = None
    description: str | None = None
    points: int
    passPoints: int
    standards: list[StandardItem] = []


class CreateRubricRequest(BaseModel):
    """Request for creating a rubric."""

    name: str
    description: str | None = None
    active: bool = True
    points: int
    passPoints: int
    department_ids: list[str] = []
    standard_groups: list[StandardGroupItem] = []


class CreateRubricResponse(BaseModel):
    """Response for creating a rubric."""

    success: bool
    rubricId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateRubricResponse)
async def create_rubric(
    request: CreateRubricRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateRubricResponse:
    """Create a new rubric with nested structure."""
    tags = ["rubrics"]  # From router tags
    
    try:
        async with transaction(conn):
            # Create rubric
            sql = load_sql("sql/v3/rubrics/create_rubric.sql")
            row = await conn.fetchrow(
                sql,
                request.name,
                request.description,
                request.active,
                request.points,
                request.passPoints,
            )

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create rubric")

            rubric_id = str(row["id"])

            # Create rubric-department links
            if request.department_ids:
                dept_sql = load_sql("sql/v3/rubrics/create_rubric_departments.sql")
                await conn.execute(dept_sql, uuid.UUID(rubric_id), request.department_ids)

            # Create standard groups and standards
            create_group_sql = load_sql("sql/v3/rubrics/create_standard_group.sql")
            create_standard_sql = load_sql("sql/v3/rubrics/create_standard.sql")

            for group in request.standard_groups:
                group_row = await conn.fetchrow(
                    create_group_sql,
                    uuid.UUID(rubric_id),
                    group.name,
                    group.short_name,
                    group.description,
                    group.points,
                    group.passPoints,
                )
                if group_row:
                    group_id = group_row["id"]
                    for standard in group.standards:
                        await conn.fetchrow(
                            create_standard_sql,
                            group_id,
                            standard.name,
                            standard.description,
                            standard.points,
                        )

        result = CreateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message="Rubric created successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


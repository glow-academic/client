"""Rubric update endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
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


@router.post("/update")
async def update_rubric(
    request: UpdateRubricRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateRubricResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
    try:
        async with transaction(conn):
            # Update rubric
            sql = load_sql("sql/v3/rubrics/update_rubric.sql")
            await conn.execute(
                sql,
                uuid.UUID(request.rubricId),
                request.name,
                request.description,
                request.active,
                request.points,
                request.passPoints,
            )

            # Update departments (delete old, create new)
            delete_dept_sql = load_sql("sql/v3/rubrics/delete_rubric_departments.sql")
            await conn.execute(delete_dept_sql, uuid.UUID(request.rubricId))

            if request.department_ids:
                dept_sql = load_sql("sql/v3/rubrics/create_rubric_departments.sql")
                await conn.execute(dept_sql, uuid.UUID(request.rubricId), request.department_ids)

            # Delete old standard groups (cascade deletes standards)
            delete_groups_sql = load_sql("sql/v3/rubrics/delete_standard_groups.sql")
            await conn.execute(delete_groups_sql, uuid.UUID(request.rubricId))

            # Create new standard groups and standards
            create_group_sql = load_sql("sql/v3/rubrics/create_standard_group.sql")
            create_standard_sql = load_sql("sql/v3/rubrics/create_standard.sql")

            for group in request.standard_groups:
                group_row = await conn.fetchrow(
                    create_group_sql,
                    uuid.UUID(request.rubricId),
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

        return UpdateRubricResponse(
            success=True,
            message="Rubric updated successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


"""Cohort update endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class UpdateCohortRequest(BaseModel):
    """Request for updating a cohort."""

    cohortId: str
    title: str
    description: str | None = None
    active: bool
    department_ids: list[str] = []
    profile_ids: list[str] = []
    simulation_ids: list[str] = []


class UpdateCohortResponse(BaseModel):
    """Response for updating a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateCohortResponse)
async def update_cohort(
    request: UpdateCohortRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateCohortResponse:
    """Update an existing cohort."""
    tags = ["cohorts"]  # From router tags
    
    try:
        async with transaction(conn):
            # Update cohort
            sql = load_sql("sql/v3/cohorts/update_cohort.sql")
            await conn.execute(sql, uuid.UUID(request.cohortId), request.title, request.description, request.active)

            # Update departments (delete old, create new)
            delete_dept_sql = load_sql("sql/v3/cohorts/delete_cohort_departments.sql")
            await conn.execute(delete_dept_sql, uuid.UUID(request.cohortId))

            if request.department_ids:
                dept_sql = load_sql("sql/v3/cohorts/create_cohort_departments.sql")
                await conn.execute(dept_sql, uuid.UUID(request.cohortId), request.department_ids)

            # Note: Profile and simulation associations are not updated in this endpoint.
            # Use dedicated endpoints (add-profiles, remove-profiles) for managing these relationships.

        result = UpdateCohortResponse(
            success=True,
            message="Cohort updated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


"""Cohort create endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


class CreateCohortRequest(BaseModel):
    """Request for creating a cohort."""

    title: str
    description: str | None = None
    active: bool = True
    department_ids: list[str] = []
    profile_ids: list[str] = []
    simulation_ids: list[str] = []


class CreateCohortResponse(BaseModel):
    """Response for creating a cohort."""

    success: bool
    cohortId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateCohortResponse)
async def create_cohort(
    request: CreateCohortRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateCohortResponse:
    """Create a new cohort."""
    tags = ["cohorts"]  # From router tags
    
    try:
        async with transaction(conn):
            # Create cohort
            # Handle None description (cohorts.description is NOT NULL, so use empty string)
            description = request.description if request.description is not None else ""
            sql = load_sql("sql/v3/cohorts/create_cohort.sql")
            row = await conn.fetchrow(sql, request.title, description, request.active)

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create cohort")

            cohort_id = str(row["id"])

            # Create cohort-department links
            if request.department_ids:
                dept_sql = load_sql("sql/v3/cohorts/create_cohort_departments.sql")
                await conn.execute(dept_sql, cohort_id, request.department_ids)

            # Create cohort-profile links
            if request.profile_ids:
                profile_sql = load_sql("sql/v3/cohorts/insert_cohort_profile.sql")
                for profile_id in request.profile_ids:
                    await conn.execute(profile_sql, uuid.UUID(cohort_id), uuid.UUID(profile_id))

            # Create cohort-simulation links
            if request.simulation_ids:
                sim_sql = load_sql("sql/v3/cohorts/insert_cohort_simulation.sql")
                for simulation_id in request.simulation_ids:
                    await conn.execute(sim_sql, uuid.UUID(cohort_id), uuid.UUID(simulation_id))

        result = CreateCohortResponse(
            success=True,
            cohortId=cohort_id,
            message="Cohort created successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


"""Cohort create endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateCohortResponse:
    """Create a new cohort."""
    tags = ["cohorts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Create cohort
            # Handle None description (cohorts.description is NOT NULL, so use empty string)
            description = request.description if request.description is not None else ""
            sql_query = load_sql("sql/v3/cohorts/create_cohort.sql")
            sql_params = (request.title, description, request.active)
            row = await conn.fetchrow(sql_query, request.title, description, request.active)

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


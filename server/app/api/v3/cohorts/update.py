"""Cohort update endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateCohortResponse:
    """Update an existing cohort."""
    tags = ["cohorts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Update cohort
            # Handle None description (cohorts.description is NOT NULL, so use empty string)
            description = request.description if request.description is not None else ""
            sql_query = load_sql("sql/v3/cohorts/update_cohort.sql")
            sql_params = (uuid.UUID(request.cohortId), request.title, description, request.active)
            await conn.execute(sql_query, uuid.UUID(request.cohortId), request.title, description, request.active)

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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


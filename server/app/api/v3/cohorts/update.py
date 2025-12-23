"""Cohort update endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


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


@router.post(
    "/update",
    response_model=UpdateCohortResponse,
    dependencies=[
        audit_activity(
            "cohort.updated", "{{ actor.name }} updated cohort '{{ cohort.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Handle None description (cohorts.description is NOT NULL, so use empty string)
        description = request.description if request.description is not None else ""

        # Single consolidated query: updates cohort, department, profile, and simulation relationships
        sql_query = load_sql("app/sql/v3/cohorts/update_cohort_complete.sql")
        sql_params = (
            uuid.UUID(request.cohortId),
            request.title,
            description,
            request.active,
            request.department_ids if request.department_ids else [],
            request.profile_ids if request.profile_ids else [],
            request.simulation_ids if request.simulation_ids else [],
            uuid.UUID(profile_id),
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=404, detail="Cohort not found")

            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    cohort={"name": request.title, "id": request.cohortId},
                )

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

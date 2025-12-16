"""Cohort create endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class CreateCohortRequest(BaseModel):
    """Request for creating a cohort."""

    title: str
    description: str | None = None
    active: bool = True
    department_ids: list[str] = []
    profile_ids: list[str] = []
    simulation_ids: list[str] = []
    profileId: str  # Required for auditing/access control


class CreateCohortResponse(BaseModel):
    """Response for creating a cohort."""

    success: bool
    cohortId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateCohortResponse,
    dependencies=[
        audit_activity(
            "cohort.created", "{{ actor.name }} created cohort '{{ cohort.title }}'"
        )
    ],
)
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
        # Handle None description (cohorts.description is NOT NULL, so use empty string)
        description = request.description if request.description is not None else ""

        # Require profileId in request body (already required by Pydantic model)
        profile_id = request.profileId

        # Single consolidated query: creates cohort and all relationships using arrays
        sql_query = load_sql("sql/v3/cohorts/create_cohort_complete.sql")
        sql_params = (
            request.title,
            description,
            request.active,
            request.department_ids if request.department_ids else [],
            request.profile_ids if request.profile_ids else [],
            request.simulation_ids if request.simulation_ids else [],
            profile_id,
        )

        async with transaction(conn):
            row = await conn.fetchrow(sql_query, *sql_params)

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create cohort")

            cohort_id = str(row["id"])
            actor_name = row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    cohort={"title": request.title, "id": cohort_id},
                )

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

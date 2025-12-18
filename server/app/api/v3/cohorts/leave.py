"""Cohort leave endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class LeaveCohortRequest(BaseModel):
    """Request for leaving a cohort."""

    cohortId: str
    # profileId removed - comes from X-Profile-Id header


class LeaveCohortResponse(BaseModel):
    """Response for leaving a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/leave",
    response_model=LeaveCohortResponse,
    dependencies=[
        audit_activity(
            "cohort.left", "{{ actor.name }} left cohort '{{ cohort.name }}'"
        )
    ],
)
async def leave_cohort(
    request: LeaveCohortRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaveCohortResponse:
    """Remove profile from cohort (leave cohort)."""
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

        sql_query = load_sql("sql/v3/cohorts/leave_cohort.sql")
        sql_params = (uuid.UUID(request.cohortId), uuid.UUID(profile_id))
        result_row = await conn.fetchrow(
            sql_query, uuid.UUID(request.cohortId), uuid.UUID(profile_id)
        )

        if result_row:
            cohort_name = result_row.get("cohort_title", "Unknown")
            actor_name = result_row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    cohort={"name": cohort_name, "id": request.cohortId},
                )

        result = LeaveCohortResponse(
            success=True,
            message="Successfully left cohort",
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
            operation="leave_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

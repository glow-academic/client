"""Cohort delete endpoint - v3 API."""

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


class DeleteCohortRequest(BaseModel):
    """Request for deleting a cohort."""

    cohortId: str


class DeleteCohortResponse(BaseModel):
    """Response for deleting a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteCohortResponse,
    dependencies=[
        audit_activity(
            "cohort.deleted", "{{ actor.name }} deleted cohort '{{ cohort.name }}'"
        )
    ],
)
async def delete_cohort(
    request: DeleteCohortRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteCohortResponse:
    """Delete a cohort."""
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

        # Delete cohort with usage check (single query)
        sql_query = load_sql("sql/v3/cohorts/delete_cohort_complete.sql")
        sql_params = (uuid.UUID(request.cohortId), uuid.UUID(profile_id))
        result = await conn.fetchrow(
            sql_query, uuid.UUID(request.cohortId), uuid.UUID(profile_id)
        )

        if not result:
            # Cohort doesn't exist - idempotent delete
            result_response = DeleteCohortResponse(
                success=True,
                message="Cohort deleted successfully",
            )
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)
            return result_response

        if result["usage_count"] > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete cohort: has {result['usage_count']} profile link(s) (preserved for historical data)",
            )

        cohort_name = result.get("title", "Unknown")
        actor_name = result.get("actor_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                cohort={"name": cohort_name, "id": request.cohortId},
            )

        result = DeleteCohortResponse(
            success=True,
            message="Cohort deleted successfully",
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
            operation="delete_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Rubric delete endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class DeleteRubricRequest(BaseModel):
    """Request for deleting a rubric."""

    rubricId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteRubricResponse(BaseModel):
    """Response for deleting a rubric."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteRubricResponse,
    dependencies=[
        audit_activity(
            "rubric.deleted", "{{ actor.name }} deleted rubric '{{ rubric.name }}'"
        )
    ],
)
async def delete_rubric(
    request: DeleteRubricRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricResponse:
    """Delete a rubric."""
    tags = ["rubrics"]  # From router tags

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

        # Delete rubric with existence and usage checks in a single SQL file
        sql_query = load_sql("sql/v3/rubrics/delete_rubric_complete.sql")
        sql_params = (request.rubricId, profile_id)
        result = await conn.fetchrow(sql_query, request.rubricId, profile_id)

        if not result:
            # Rubric doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Rubric {request.rubricId} not found"
            )

        # Check if rubric was deleted or is in use
        if not result["deleted"]:
            # Rubric exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete rubric: in use by {usage_count} simulation(s)",
            )

        rubric_name = result["name"]
        actor_name = result["actor_name"]
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                rubric={"name": rubric_name, "id": request.rubricId},
            )

        result_data = DeleteRubricResponse(
            success=True,
            message="Rubric deleted successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

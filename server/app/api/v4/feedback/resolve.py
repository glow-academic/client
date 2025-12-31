"""Feedback resolve endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db


# Inline request/response schemas
class ResolveFeedbackRequest(BaseModel):
    """Request to resolve/unresolve feedback."""

    feedback_id: str
    resolved: bool
    # profileId removed - comes from X-Profile-Id header


class ResolveFeedbackResponse(BaseModel):
    """Response for resolve feedback endpoint."""

    feedback_id: str
    resolved: bool
    success: bool
    message: str


router = APIRouter()


@router.post(
    "/resolve",
    response_model=ResolveFeedbackResponse,
    dependencies=[
        audit_activity(
            "feedback.resolved",
            "{{ actor.name }} {{ resolved ? 'resolved' : 'unresolved' }} feedback",
        )
    ],
)
async def resolve_feedback(
    request_body: ResolveFeedbackRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ResolveFeedbackResponse:
    """Resolve or unresolve a feedback entry."""
    tags = ["feedback"]  # From router tags

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

        # Validate feedback_id
        try:
            import uuid

            uuid.UUID(request_body.feedback_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid feedback_id format")

        # Load SQL query
        sql_query = load_sql("app/sql/v4/feedback/resolve_feedback.sql")
        sql_params = (request_body.feedback_id, request_body.resolved)

        # Execute update query within transaction
        async with conn.transaction():
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=404, detail="Feedback entry not found")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                resolved=request_body.resolved,
            )

        result_data = ResolveFeedbackResponse(
            feedback_id=str(result["id"]),
            resolved=result["resolved"],
            success=True,
            message=f"Feedback {'resolved' if request_body.resolved else 'unresolved'} successfully",
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
            operation="resolve_feedback",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

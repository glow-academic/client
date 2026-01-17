"""Feedback create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class CreateFeedbackRequest(BaseModel):
    type: str
    message: str
    # profileId removed - comes from X-Profile-Id header


class CreateFeedbackResponse(BaseModel):
    feedback_id: str  # UUID
    success: bool
    message: str


router = APIRouter(prefix="/debug", tags=["debug"])


@router.post(
    "/debug",
    response_model=CreateFeedbackResponse,
    dependencies=[
        audit_activity(
            "feedback.created",
            "{{ actor.name }} submitted {{ feedback.type }} feedback",
        )
    ],
)
async def create_feedback(
    request: CreateFeedbackRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFeedbackResponse:
    """Create new app feedback entry."""
    tags = ["feedback"]  # From router tags

    try:
        # Validate feedback type
        valid_types = ["feature", "bug", "question", "other"]
        if request.type not in valid_types:
            raise HTTPException(
                status_code=400, detail=f"Invalid feedback type: {request.type}"
            )

        # Validate message
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message is required")

        if len(request.message) > 1000:
            raise HTTPException(
                status_code=400, detail="Message must be less than 1000 characters"
            )

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Execute insert query
        sql_query = load_sql("app/sql/v4/feedback/create_feedback.sql")
        sql_params = (request.type, request.message, profile_id)
        result = await conn.fetchrow(
            sql_query, request.type, request.message, profile_id
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create feedback")

        actor_name = result.get("actor_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                feedback={"type": request.type},
            )

        result_data = CreateFeedbackResponse(
            feedback_id=str(result["feedback_id"]),  # Convert UUID to string
            success=True,
            message="Feedback created successfully",
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
            operation="create_feedback",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

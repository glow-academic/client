"""Feedback create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateFeedbackRequest(BaseModel):
    type: str
    message: str
    profileId: str


class CreateFeedbackResponse(BaseModel):
    feedback_id: int
    success: bool
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateFeedbackResponse)
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

        # Execute insert query
        sql_query = load_sql("sql/v3/feedback/create_feedback.sql")
        sql_params = (request.type, request.message, request.profileId)
        result = await conn.fetchrow(
            sql_query, request.type, request.message, request.profileId
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create feedback")

        result_data = CreateFeedbackResponse(
            feedback_id=result["feedback_id"],
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

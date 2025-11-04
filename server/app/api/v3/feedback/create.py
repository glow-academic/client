"""Feedback create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
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


@router.post("/create")
async def create_feedback(
    request: CreateFeedbackRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFeedbackResponse:
    """Create new app feedback entry."""
    try:
        # Validate feedback type
        valid_types = ["feature", "bug", "question", "other"]
        if request.type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid feedback type: {request.type}")

        # Validate message
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message is required")

        if len(request.message) > 1000:
            raise HTTPException(status_code=400, detail="Message must be less than 1000 characters")

        # Execute insert query
        sql = load_sql("sql/v3/feedback/create_feedback.sql")
        result = await conn.fetchrow(sql, request.type, request.message, request.profileId)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create feedback")

        return CreateFeedbackResponse(
            feedback_id=result["feedback_id"],
            success=True,
            message="Feedback created successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


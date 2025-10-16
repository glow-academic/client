"""Feedback v2 API endpoints."""

from typing import Annotated

import asyncpg # type: ignore
from app.db import get_db
from app.repositories.feedback_repository import get_feedback_repository
from app.schemas.feedback import (CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackListRequest,
                                  FeedbackListResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/list", response_model=FeedbackListResponse)
async def list_feedback(
    request: FeedbackListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FeedbackListResponse:
    """Get list of feedback with author information."""
    repo = get_feedback_repository(conn)
    return await repo.get_feedback_list(request)


@router.post("/create", response_model=CreateFeedbackResponse)
async def create_feedback(
    request: CreateFeedbackRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFeedbackResponse:
    """Create new app feedback entry."""
    try:
        repo = get_feedback_repository(conn)
        return await repo.create_feedback(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

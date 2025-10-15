"""Feedback v2 API endpoints."""

from app.db import get_session
from app.repositories.feedback_repository import FeedbackRepository
from app.schemas.feedback import (CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackListRequest,
                                  FeedbackListResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/list", response_model=FeedbackListResponse)
async def list_feedback(
    request: FeedbackListRequest,
    session: AsyncSession = Depends(get_session),
) -> FeedbackListResponse:
    """Get list of feedback with author information."""
    repo = FeedbackRepository()
    return await repo.get_feedback_list(request, session)


@router.post("/create", response_model=CreateFeedbackResponse)
async def create_feedback(
    request: CreateFeedbackRequest,
    session: AsyncSession = Depends(get_session),
) -> CreateFeedbackResponse:
    """Create new app feedback entry."""
    try:
        repo = FeedbackRepository()
        return await repo.create_feedback(request, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


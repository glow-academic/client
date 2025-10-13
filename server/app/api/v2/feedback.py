"""Feedback v2 API endpoints (read-only)."""

from app.db import get_session
from app.repositories.feedback_repository import FeedbackRepository
from app.schemas.feedback import FeedbackListRequest, FeedbackListResponse
from fastapi import APIRouter, Depends
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


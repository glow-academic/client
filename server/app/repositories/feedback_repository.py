"""Feedback repository - thin wrapper around service."""

from app.schemas.feedback import FeedbackListRequest, FeedbackListResponse
from app.services.feedback_service import FeedbackService
from sqlalchemy.ext.asyncio import AsyncSession


class FeedbackRepository:
    """Repository for feedback operations."""

    def __init__(self) -> None:
        """Initialize repository with service."""
        self.service = FeedbackService()

    async def get_feedback_list(
        self, request: FeedbackListRequest, session: AsyncSession
    ) -> FeedbackListResponse:
        """Get list of feedback."""
        return await self.service.get_feedback_list(request, session)


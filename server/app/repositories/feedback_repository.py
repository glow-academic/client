"""Feedback repository - thin wrapper around service."""

import asyncpg # type: ignore
from app.schemas.feedback import (CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackListRequest,
                                  FeedbackListResponse)
from app.services.feedback_service import FeedbackService


class FeedbackRepository:
    """Repository for feedback operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = FeedbackService(conn)

    async def get_feedback_list(
        self, request: FeedbackListRequest
    ) -> FeedbackListResponse:
        """Get list of feedback."""
        return await self.service.get_feedback_list(request)

    async def create_feedback(
        self, request: CreateFeedbackRequest
    ) -> CreateFeedbackResponse:
        """Create new feedback entry."""
        return await self.service.create_feedback(request)


def get_feedback_repository(conn: asyncpg.Connection) -> FeedbackRepository:
    """Get feedback repository instance."""
    return FeedbackRepository(conn)

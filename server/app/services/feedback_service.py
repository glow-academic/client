"""Feedback service with business logic and dynamic SQL."""

from typing import List

from app.queries.feedback_queries import FeedbackQueries
from app.schemas.feedback import (FeedbackItem, FeedbackListRequest,
                                  FeedbackListResponse)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class FeedbackService:
    """Service for feedback operations."""

    def __init__(self) -> None:
        """Initialize service with query builders."""
        self.queries = FeedbackQueries()

    async def get_feedback_list(
        self, request: FeedbackListRequest, session: AsyncSession
    ) -> FeedbackListResponse:
        """
        Get list of feedback with author information.

        Args:
            request: List request
            session: Database session

        Returns:
            FeedbackListResponse
        """
        query, params = self.queries.get_feedback_list()

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        feedback_items: List[FeedbackItem] = []
        for row in rows:
            feedback_items.append(
                FeedbackItem(
                    feedback_id=row.feedback_id,
                    type=row.type,
                    message=row.message,
                    created_at=row.created_at.isoformat()
                    if row.created_at
                    else "",
                    author_name=row.author_name,
                    author_alias=row.author_alias,
                    author_profile_id=row.author_profile_id,
                )
            )

        return FeedbackListResponse(feedback=feedback_items)


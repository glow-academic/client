"""Feedback service with business logic and dynamic SQL."""

from typing import List

from app.queries.feedback_queries import FeedbackQueries
from app.schemas.feedback import (CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackItem,
                                  FeedbackListRequest, FeedbackListResponse)
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

    async def create_feedback(
        self, request: CreateFeedbackRequest, session: AsyncSession
    ) -> CreateFeedbackResponse:
        """
        Create new feedback entry.

        Args:
            request: Create request with type, message, and profileId
            session: Database session

        Returns:
            CreateFeedbackResponse
        """
        # Validate feedback type
        valid_types = ["feature", "bug", "question", "other"]
        if request.type not in valid_types:
            raise ValueError(f"Invalid feedback type: {request.type}")

        # Validate message
        if not request.message or not request.message.strip():
            raise ValueError("Message is required")

        if len(request.message) > 1000:
            raise ValueError("Message must be less than 1000 characters")

        # Execute insert query
        query, params = self.queries.create_feedback(
            request.type, request.message, request.profileId
        )

        result = await session.execute(text(query), params)
        await session.commit()

        row = result.fetchone()

        if not row:
            raise ValueError("Failed to create feedback")

        return CreateFeedbackResponse(
            feedback_id=row.feedback_id,
            success=True,
            message="Feedback created successfully",
        )


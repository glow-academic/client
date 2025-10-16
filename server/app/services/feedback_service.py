"""Feedback service with business logic and dynamic SQL."""

from typing import List

import asyncpg
from app.queries.feedback_queries import FeedbackQueries
from app.schemas.feedback import (CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackItem,
                                  FeedbackListRequest, FeedbackListResponse)


class FeedbackService:
    """Service for feedback operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = FeedbackQueries()

    async def get_feedback_list(
        self, request: FeedbackListRequest
    ) -> FeedbackListResponse:
        """
        Get list of feedback with author information.

        Args:
            request: List request

        Returns:
            FeedbackListResponse
        """
        query, params = self.queries.get_feedback_list()

        rows = await self.conn.fetch(query, *params)

        feedback_items: List[FeedbackItem] = []
        for row in rows:
            feedback_items.append(
                FeedbackItem(
                    feedback_id=row['feedback_id'],
                    type=row['type'],
                    message=row['message'],
                    created_at=row['created_at'].isoformat()
                    if row['created_at']
                    else "",
                    author_name=row['author_name'],
                    author_alias=row['author_alias'],
                    author_profile_id=row['author_profile_id'],
                )
            )

        return FeedbackListResponse(feedback=feedback_items)

    async def create_feedback(
        self, request: CreateFeedbackRequest
    ) -> CreateFeedbackResponse:
        """
        Create new feedback entry.

        Args:
            request: Create request with type, message, and profileId

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

        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("Failed to create feedback")

        return CreateFeedbackResponse(
            feedback_id=result['feedback_id'],
            success=True,
            message="Feedback created successfully",
        )

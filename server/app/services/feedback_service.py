"""Feedback service with business logic and dynamic SQL."""

import asyncpg  # type: ignore
from app.queries.feedback_queries import FeedbackQueries
from app.schemas.feedback import (BulkDeleteFeedbackRequest,
                                  BulkDeleteFeedbackResponse,
                                  CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackItem,
                                  FeedbackListRequest, FeedbackListResponse)
from app.services.base_service import BaseService


class FeedbackService(BaseService):
    """Service for feedback operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
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

        feedback_items: list[FeedbackItem] = []
        for row in rows:
            feedback_items.append(
                FeedbackItem(
                    feedback_id=row["feedback_id"],
                    type=row["type"],
                    message=row["message"],
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    author_name=row["author_name"],
                    author_alias=row["author_alias"],
                    author_profile_id=row["author_profile_id"],
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
            feedback_id=result["feedback_id"],
            success=True,
            message="Feedback created successfully",
        )

    async def bulk_delete_feedback(
        self, request: BulkDeleteFeedbackRequest
    ) -> BulkDeleteFeedbackResponse:
        """
        Delete multiple feedback entries. Only superadmin can delete feedback.

        Args:
            request: Bulk delete request with profileId and feedback IDs

        Returns:
            BulkDeleteFeedbackResponse with deleted count

        Raises:
            ValueError: If profile not found
            PermissionError: If user is not superadmin
        """
        # Check if user is superadmin
        query, params = self.queries.check_profile_role(request.profileId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Profile not found: {request.profileId}")

        if result["role"] != "superadmin":
            raise PermissionError("Only superadmin users can delete feedback")

        if not request.ids:
            return BulkDeleteFeedbackResponse(
                success=True, deleted_count=0, message="No feedback to delete"
            )

        # Delete feedback
        query, params = self.queries.delete_feedback_bulk(request.ids)
        deleted_rows = await self.conn.fetch(query, *params)
        deleted_count = len(deleted_rows)

        return BulkDeleteFeedbackResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} feedback item(s)",
        )


def get_feedback_service(conn: asyncpg.Connection) -> FeedbackService:
    """Get feedback service instance."""
    return FeedbackService(conn)

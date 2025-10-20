"""Service layer for attempts operations."""

from datetime import datetime

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.attempts_queries import AttemptsQueries
from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse,
                                  UpdateChatCompletedAtRequest,
                                  UpdateChatCreatedAtRequest,
                                  UpdateChatTimestampResponse)
from app.services.base_service import BaseService


class AttemptsService(BaseService):
    """Service layer for attempts operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize attempts service."""
        super().__init__(conn)
        self.queries = AttemptsQueries()

    async def bulk_archive_attempts(
        self, request: BulkArchiveAttemptsRequest
    ) -> BulkArchiveAttemptsResponse:
        """Bulk archive or unarchive simulation attempts."""

        # Update all attempts
        query, params = self.queries.bulk_archive_attempts(
            request.archived, request.attemptIds
        )
        await self.conn.execute(query, *params)

        # Invalidate analytics cache (attempt changes affect all analytics)
        await self._invalidate_cache([keys.tag_analytics_all()])

        action = "archived" if request.archived else "unarchived"
        count = len(request.attemptIds)

        return BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )

    async def update_chat_created_at(
        self, request: UpdateChatCreatedAtRequest
    ) -> UpdateChatTimestampResponse:
        """Update simulation chat createdAt timestamp."""
        # Parse ISO string to datetime
        created_at = datetime.fromisoformat(request.createdAt.replace("Z", "+00:00"))

        # Update the createdAt timestamp
        query, params = self.queries.update_chat_created_at(request.chatId, created_at)
        result = await self.conn.execute(query, *params)

        if result == "UPDATE 0":
            raise ValueError(f"Chat not found: {request.chatId}")

        # Invalidate analytics cache (timestamp changes affect analytics)
        await self._invalidate_cache([keys.tag_analytics_all()])

        return UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} createdAt updated successfully",
        )

    async def update_chat_completed_at(
        self, request: UpdateChatCompletedAtRequest
    ) -> UpdateChatTimestampResponse:
        """Update simulation chat completedAt timestamp."""
        # Parse ISO string to datetime
        completed_at = datetime.fromisoformat(
            request.completedAt.replace("Z", "+00:00")
        )

        # Update the completedAt timestamp
        query, params = self.queries.update_chat_completed_at(
            request.chatId, completed_at
        )
        result = await self.conn.execute(query, *params)

        if result == "UPDATE 0":
            raise ValueError(f"Chat not found: {request.chatId}")

        # Invalidate analytics cache (timestamp changes affect analytics)
        await self._invalidate_cache([keys.tag_analytics_all()])

        return UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} completedAt updated successfully",
        )


def get_attempts_service(conn: asyncpg.Connection) -> AttemptsService:
    """Get attempts service instance."""
    return AttemptsService(conn)

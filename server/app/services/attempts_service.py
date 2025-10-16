"""Service layer for attempts operations."""

import asyncpg  # type: ignore
from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse)


class AttemptsService:
    """Service layer for attempts operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize attempts service."""
        self.conn = conn

    async def bulk_archive_attempts(
        self, request: BulkArchiveAttemptsRequest
    ) -> BulkArchiveAttemptsResponse:
        """Bulk archive or unarchive simulation attempts."""

        # Update all attempts
        await self.conn.execute(
            """UPDATE simulation_attempts
               SET archived = $1,
                   updated_at = NOW()
               WHERE id = ANY($2::uuid[])""",
            request.archived,
            request.attemptIds,
        )

        action = "archived" if request.archived else "unarchived"
        count = len(request.attemptIds)

        return BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )

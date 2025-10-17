"""Service layer for attempts operations."""

import asyncpg  # type: ignore
from app.queries.attempts_queries import AttemptsQueries
from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse)


class AttemptsService:
    """Service layer for attempts operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize attempts service."""
        self.conn = conn
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

        action = "archived" if request.archived else "unarchived"
        count = len(request.attemptIds)

        return BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )


def get_attempts_service(conn: asyncpg.Connection) -> AttemptsService:
    """Get attempts service instance."""
    return AttemptsService(conn)

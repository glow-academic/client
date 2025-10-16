"""Repository layer for attempts operations."""

from typing import Optional

import asyncpg  # type: ignore
from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse)
from app.services.attempts_service import get_attempts_service


class AttemptsRepository:
    """Repository layer for attempts operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize attempts repository."""
        self.service = get_attempts_service(conn)

    async def bulk_archive_attempts(
        self, request: BulkArchiveAttemptsRequest
    ) -> BulkArchiveAttemptsResponse:
        """Bulk archive or unarchive simulation attempts."""
        return await self.service.bulk_archive_attempts(request)


def get_attempts_repository(conn: asyncpg.Connection) -> AttemptsRepository:
    """Get attempts repository instance."""
    return AttemptsRepository(conn)


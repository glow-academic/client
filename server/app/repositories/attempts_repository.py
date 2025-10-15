"""Repository layer for attempts operations."""

from typing import Optional

from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse)
from app.services.attempts_service import get_attempts_service
from sqlalchemy.orm import Session


class AttemptsRepository:
    """Repository layer for attempts operations."""

    def __init__(self, db: Session):
        """Initialize attempts repository."""
        self.service = get_attempts_service(db)

    def bulk_archive_attempts(
        self, request: BulkArchiveAttemptsRequest
    ) -> BulkArchiveAttemptsResponse:
        """Bulk archive or unarchive simulation attempts."""
        return self.service.bulk_archive_attempts(request)


def get_attempts_repository(db: Optional[Session] = None) -> AttemptsRepository:
    """Get attempts repository instance."""
    if db is None:
        from app.db import get_session

        db = next(get_session())
    return AttemptsRepository(db)


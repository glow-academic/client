"""Service layer for attempts operations."""

from typing import Optional

from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class AttemptsService:
    """Service layer for attempts operations."""

    def __init__(self, db: Session):
        """Initialize attempts service."""
        self.db = db

    def bulk_archive_attempts(
        self, request: BulkArchiveAttemptsRequest
    ) -> BulkArchiveAttemptsResponse:
        """Bulk archive or unarchive simulation attempts."""

        # Update all attempts
        update_query = text("""
            UPDATE simulation_attempts
            SET archived = :archived,
                updated_at = NOW()
            WHERE id = ANY(:attempt_ids::uuid[])
        """)

        self.db.execute(
            update_query,
            {
                "archived": request.archived,
                "attempt_ids": request.attemptIds,
            },
        )

        self.db.commit()

        action = "archived" if request.archived else "unarchived"
        count = len(request.attemptIds)

        return BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )


def get_attempts_service(db: Optional[Session] = None) -> AttemptsService:
    """Get attempts service instance."""
    if db is None:
        from app.db import get_session

        db = next(get_session())
    return AttemptsService(db)


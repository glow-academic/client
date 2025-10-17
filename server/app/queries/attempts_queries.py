"""Attempts query builders with dynamic SQL."""

from typing import Any, List, Tuple


class AttemptsQueries:
    """Query builders for attempts operations."""

    def bulk_archive_attempts(
        self, archived: bool, attempt_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """
        Bulk update archived status for simulation attempts.

        Args:
            archived: Whether to archive (True) or unarchive (False)
            attempt_ids: List of attempt UUIDs

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE simulation_attempts
        SET archived = $1,
            updated_at = NOW()
        WHERE id = ANY($2::uuid[])
        """

        params = [archived, attempt_ids]
        return query, params


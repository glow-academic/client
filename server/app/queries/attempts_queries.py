"""Attempts query builders with dynamic SQL."""

from typing import Any


class AttemptsQueries:
    """Query builders for attempts operations."""

    def bulk_archive_attempts(
        self, archived: bool, attempt_ids: list[str]
    ) -> tuple[str, list[Any]]:
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

    def update_chat_created_at(
        self, chat_id: str, created_at: Any
    ) -> tuple[str, list[Any]]:
        """
        Update simulation chat created_at timestamp.

        Args:
            chat_id: Chat UUID
            created_at: New created_at timestamp

        Returns:
            Tuple of (query, params)
        """
        query = "UPDATE simulation_chats SET created_at = $1 WHERE id = $2"
        params = [created_at, chat_id]
        return query, params

    def update_chat_completed_at(
        self, chat_id: str, completed_at: Any
    ) -> tuple[str, list[Any]]:
        """
        Update simulation chat completed_at timestamp.

        Args:
            chat_id: Chat UUID
            completed_at: New completed_at timestamp

        Returns:
            Tuple of (query, params)
        """
        query = "UPDATE simulation_chats SET completed_at = $1 WHERE id = $2"
        params = [completed_at, chat_id]
        return query, params

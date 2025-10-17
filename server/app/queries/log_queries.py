"""Log query builders with dynamic SQL."""

from typing import Any, List


class LogQueries:
    """Query builders for log operations."""

    def get_logs_list(self) -> tuple[str, List[Any]]:
        """
        Get logs list with actor name resolution and all JSONB fields.

        Joins:
        - app_logs
        - profiles (for actor name resolution)

        Actor name resolution priority:
        1. actor.profileName if present
        2. profiles.first_name + last_name if actor.profileId matches
        3. actor.userId if present
        4. null

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            al.id as log_id,
            al.event,
            al.level,
            al.message,
            al.correlation_id,
            al.actor,
            al.subject,
            al.metrics,
            al.context,
            al.error,
            al.created_at,
            CASE
                WHEN al.actor->>'profileName' IS NOT NULL THEN al.actor->>'profileName'
                WHEN al.actor->>'profileId' IS NOT NULL AND p.first_name IS NOT NULL 
                    THEN p.first_name || ' ' || p.last_name
                WHEN al.actor->>'userId' IS NOT NULL THEN al.actor->>'userId'
                ELSE NULL
            END as actor_name
        FROM app_logs al
        LEFT JOIN profiles p ON (al.actor->>'profileId')::uuid = p.id
        ORDER BY al.created_at DESC
        """

        params: List[Any] = []

        return query, params

    def get_recent_logs(self, level: str, limit: int) -> tuple[str, List[Any]]:
        """
        Get recent app logs filtered by level.

        Args:
            level: Log level filter (or "all" for no filtering)
            limit: Maximum number of logs to return

        Returns:
            Tuple of (query, params)
        """
        if level.lower() == "all":
            query = """
                SELECT id, level, message, context, created_at
                FROM app_logs
                ORDER BY created_at DESC
                LIMIT $1
            """
            return query, [limit]
        else:
            query = """
                SELECT id, level, message, context, created_at
                FROM app_logs
                WHERE LOWER(level) LIKE LOWER($1)
                ORDER BY created_at DESC
                LIMIT $2
            """
            return query, [f"%{level.lower()}%", limit]

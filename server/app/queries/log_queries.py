"""Log queries - SQL query builders."""

from typing import Any, List, Tuple


class LogQueries:
    """Query builders for log operations."""

    def insert_log(self) -> Tuple[str, List[Any]]:
        """Build query to insert a log entry."""
        query = """
        INSERT INTO app_logs (
            event,
            level,
            message,
            correlation_id,
            actor,
            subject,
            metrics,
            context,
            error,
            created_at
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_logs_list(self) -> Tuple[str, List[Any]]:
        """Build query to get logs list with actor information."""
        query = """
        SELECT 
            al.id::text as log_id,
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
            COALESCE(
                p.first_name || ' ' || p.last_name,
                (al.actor->>'profileId')::text,
                'System'
            ) as actor_name
        FROM app_logs al
        LEFT JOIN profiles p ON p.id::text = (al.actor->>'profileId')::text
        ORDER BY al.created_at DESC
        LIMIT 1000
        """
        return (query, [])

    def get_recent_logs(self, level: str, limit: int) -> Tuple[str, List[Any]]:
        """Build query to get recent logs filtered by level."""
        query = """
        SELECT 
            id,
            level,
            message,
            context,
            created_at
        FROM app_logs
        WHERE ($1 = 'all' OR level = $1)
        ORDER BY created_at DESC
        LIMIT $2
        """
        return (query, [level, limit])

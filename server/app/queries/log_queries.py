"""Log query builders with dynamic SQL."""

from typing import Any, Dict


class LogQueries:
    """Query builders for log operations."""

    def get_logs_list(self) -> tuple[str, Dict[str, Any]]:
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

        params: Dict[str, Any] = {}

        return query, params


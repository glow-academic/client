"""Feedback query builders with dynamic SQL."""

from typing import Any, Dict


class FeedbackQueries:
    """Query builders for feedback operations."""

    def get_feedback_list(self) -> tuple[str, Dict[str, Any]]:
        """
        Get feedback list with author information.

        Joins:
        - app_feedback
        - app_feedback_profiles (role='author')
        - profiles (for author name and alias)

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            af.id as feedback_id,
            af.type,
            COALESCE(af.message, '') as message,
            af.created_at,
            COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as author_name,
            COALESCE(p.alias, '') as author_alias,
            COALESCE(afp.profile_id::text, '') as author_profile_id
        FROM app_feedback af
        LEFT JOIN app_feedback_profiles afp ON afp.app_feedback_id = af.id AND afp.role = 'author'
        LEFT JOIN profiles p ON p.id = afp.profile_id
        ORDER BY af.created_at DESC
        """

        params: Dict[str, Any] = {}

        return query, params


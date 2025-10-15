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

    def create_feedback(
        self, feedback_type: str, message: str, profile_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Create new feedback entry and associate with author profile.

        Steps:
        1. INSERT into app_feedback table
        2. INSERT into app_feedback_profiles junction table (role='author')

        Args:
            feedback_type: Type of feedback ('feature', 'bug', 'question', 'other')
            message: Feedback message
            profile_id: Author profile ID (UUID as string)

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH new_feedback AS (
            INSERT INTO app_feedback (type, message, created_at)
            VALUES (:type, :message, NOW())
            RETURNING id
        )
        INSERT INTO app_feedback_profiles (app_feedback_id, profile_id, role)
        SELECT nf.id, :profile_id::uuid, 'author'
        FROM new_feedback nf
        RETURNING (SELECT id FROM new_feedback) as feedback_id
        """

        params = {
            "type": feedback_type,
            "message": message,
            "profile_id": profile_id,
        }

        return query, params


"""Grading service layer - business logic for grading operations."""

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

import asyncpg  # type: ignore
from app.cache import keys
from app.extensions import get_query_client
from app.queries.grading_queries import GradingQueries


class GradingService:
    """Service layer for grading operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = GradingQueries()

    async def save_grading_results(
        self,
        simulation_chat_id: UUID,
        rubric_id: UUID,
        overall_score: int,
        passed: bool,
        summary: str,
        actual_time_taken: int,
        grading_results: Dict[str, Any],
        standard_groups: List[Dict[str, Any]],
        standards: List[Dict[str, Any]],
    ) -> UUID:
        """
        Save grading results including grade record, feedback records, and mark chat as completed.

        This consolidates 3+ database operations:
        1. Create simulation_chat_grade record
        2. Create simulation_chat_feedbacks records (one per standard group)
        3. Mark simulation_chat as completed

        Args:
            simulation_chat_id: ID of the chat being graded
            rubric_id: ID of the rubric used
            overall_score: Total score across all standard groups
            passed: Whether the overall score meets pass threshold
            summary: Overall evaluation summary
            actual_time_taken: Time taken in seconds
            grading_results: Dict with grading data keyed by safe field names
            standard_groups: List of standard group dicts
            standards: List of standard dicts

        Returns:
            UUID of created simulation_chat_grade

        Raises:
            ValueError: If grade creation fails
        """
        # 1. Create the simulation chat grade record
        query, params = self.queries.create_simulation_chat_grade(
            str(simulation_chat_id),
            str(rubric_id),
            passed,
            overall_score,
            summary,
            actual_time_taken,
        )
        grade_row = await self.conn.fetchrow(query, *params)

        if not grade_row:
            raise ValueError("Failed to create simulation chat grade")

        grade_id = UUID(grade_row['id'])

        # 2. Create feedback records for each standard group
        feedback_records = []
        for group in standard_groups:
            # Get safe field name to look up results
            from app.agents.collection.grade import create_safe_field_name
            safe_name = create_safe_field_name(group['short_name'])

            group_data = grading_results.get(safe_name, {})
            group_score = group_data.get("score", 0)
            group_feedback = group_data.get("feedback", "")

            # Find the corresponding standard for this score
            group_standards = [
                s for s in standards if s['standard_group_id'] == group['id']
            ]
            matching_standard = None
            for standard in group_standards:
                if standard['points'] == group_score:
                    matching_standard = standard
                    break

            if matching_standard:
                feedback_records.append({
                    'standard_id': matching_standard['id'],
                    'grade_id': grade_id,
                    'score': group_score,
                    'feedback': group_feedback,
                })

        # Batch insert feedback records
        if feedback_records:
            query, _ = self.queries.create_simulation_chat_feedbacks()
            standard_ids = [str(r['standard_id']) for r in feedback_records]
            grade_ids = [str(r['grade_id']) for r in feedback_records]
            scores = [r['score'] for r in feedback_records]
            feedbacks = [r['feedback'] for r in feedback_records]

            await self.conn.execute(query, standard_ids, grade_ids, scores, feedbacks)

        # 3. Mark chat as completed
        query, params = self.queries.mark_chat_completed(str(simulation_chat_id))
        await self.conn.execute(query, *params)

        # Invalidate affected caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[keys.tag_analytics_all()])

        return grade_id


def get_grading_service(conn: asyncpg.Connection) -> GradingService:
    """Get grading service instance."""
    return GradingService(conn)

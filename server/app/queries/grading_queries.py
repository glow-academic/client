"""Grading query builders with dynamic SQL."""

from typing import Any


class GradingQueries:
    """Query builders for grading operations."""

    def create_simulation_chat_grade(
        self,
        simulation_chat_id: str,
        rubric_id: str,
        passed: bool,
        score: int,
        description: str,
        time_taken: int,
    ) -> tuple[str, list[Any]]:
        """
        Create a simulation chat grade record.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO simulation_chat_grades 
        (passed, score, description, time_taken, rubric_id, simulation_chat_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id::text
        """

        params: list[Any] = [
            passed,
            score,
            description,
            time_taken,
            rubric_id,
            simulation_chat_id,
        ]

        return query, params

    def create_simulation_chat_feedbacks(self) -> tuple[str, list[Any]]:
        """
        Batch create simulation chat feedback records using UNNEST.

        Returns query that accepts four arrays: standard_ids, grade_ids, scores, feedbacks.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO simulation_chat_feedbacks 
        (standard_id, simulation_chat_grade_id, total, feedback, created_at)
        SELECT 
            UNNEST($1::uuid[]),
            UNNEST($2::uuid[]),
            UNNEST($3::int[]),
            UNNEST($4::text[]),
            NOW()
        """
        return query, []

    def mark_chat_completed(self, simulation_chat_id: str) -> tuple[str, list[Any]]:
        """
        Mark a simulation chat as completed.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE simulation_chats 
        SET completed = $1 
        WHERE id = $2
        """

        params: list[Any] = [True, simulation_chat_id]

        return query, params

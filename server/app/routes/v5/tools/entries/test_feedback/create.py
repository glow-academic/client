"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_feedback.types import (
    CreateTestFeedbackResponse,
)


async def create_test_feedback(
    conn: asyncpg.Connection,
    grade_id: UUID,
    call_id: UUID,
    total: int,
    feedback: str = "No feedback provided",
    total_points: int = 0,
    pass_points: int = 0,
    mcp: bool = False,
) -> CreateTestFeedbackResponse:
    """Create a test_feedback entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_feedback_entry (grade_id, call_id, total, feedback, total_points, pass_points, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        grade_id,
        call_id,
        total,
        feedback,
        total_points,
        pass_points,
        mcp,
    )
    return CreateTestFeedbackResponse(id=entry_id)

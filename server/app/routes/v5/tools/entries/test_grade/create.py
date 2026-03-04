"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.test_grade.types import CreateTestGradeResponse


async def create_test_grade(
    conn: asyncpg.Connection,
    invocation_id: UUID,
    call_id: UUID,
    run_id: UUID,
    time_taken: int,
    passed: bool,
    score: int,
    mcp: bool = False,
) -> CreateTestGradeResponse:
    """Create a test_grade entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_grade_entry
            (invocation_id, call_id, run_id, time_taken, passed, score, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        invocation_id,
        call_id,
        run_id,
        time_taken,
        passed,
        score,
        mcp,
    )

    return CreateTestGradeResponse(id=entry_id)

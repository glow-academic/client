"""Attempt practice CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_practice.types import (
    CreateAttemptPracticeResponse,
)


async def create_attempt_practice(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    practice_id: UUID,
    session_id: UUID,
    mcp: bool = False,
) -> CreateAttemptPracticeResponse:
    """Create an attempt_practice_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO attempt_practice_entry (attempt_id, practice_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        """,
        attempt_id,
        practice_id,
        session_id,
        mcp,
    )

    return CreateAttemptPracticeResponse(attempt_id=attempt_id, practice_id=practice_id)

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
    id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptPracticeResponse:
    """Create an attempt_practice_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO attempt_practice_entry (id, attempt_id, practice_id, session_id, active, mcp, generated)
        VALUES (COALESCE($6, uuidv7()), $1, $2, $3, $4, $5, true)
        """,
        attempt_id,
        practice_id,
        session_id,
        not soft,
        mcp,
        id,
    )

    return CreateAttemptPracticeResponse(attempt_id=attempt_id, practice_id=practice_id)

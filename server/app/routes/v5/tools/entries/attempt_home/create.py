"""Attempt home CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_home.types import CreateAttemptHomeResponse


async def create_attempt_home(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    home_id: UUID,
    session_id: UUID,
    mcp: bool = False,
) -> CreateAttemptHomeResponse:
    """Create an attempt_home_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO attempt_home_entry (attempt_id, home_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        """,
        attempt_id,
        home_id,
        session_id,
        mcp,
    )

    return CreateAttemptHomeResponse(attempt_id=attempt_id, home_id=home_id)

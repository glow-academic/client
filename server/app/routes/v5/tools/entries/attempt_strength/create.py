"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_strength.types import (
    CreateAttemptStrengthResponse,
)


async def create_attempt_strength(
    conn: asyncpg.Connection,
    grade_id: UUID,
    message_id: UUID,
    call_id: UUID,
    name: str,
    description: str = "No description provided",
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptStrengthResponse:
    """Create an attempt_strength entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_strength_entry (grade_id, message_id, call_id, name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        grade_id,
        message_id,
        call_id,
        name,
        description,
        not soft,
        mcp,
    )
    return CreateAttemptStrengthResponse(id=entry_id)

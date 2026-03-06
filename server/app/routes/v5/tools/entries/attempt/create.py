"""Attempt CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt.types import CreateAttemptResponse


async def create_attempt(
    conn: asyncpg.Connection,
    call_id: UUID,
    user_persona_id: UUID,
    profiles_id: UUID,
    name: str = "",
    description: str = "",
    infinite_mode: bool = False,
    num_chats: int = 1,
    practice: bool = False,
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptResponse:
    """Create an attempt entry with profiles connection."""
    attempt_id = await conn.fetchval(
        """
        INSERT INTO attempt_entry (
            call_id, user_persona_id, name, description,
            infinite_mode, num_chats, practice, active, mcp, generated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        RETURNING id
        """,
        call_id,
        user_persona_id,
        name,
        description,
        infinite_mode,
        num_chats,
        practice,
        not soft,
        mcp,
    )

    if attempt_id is None:
        raise ValueError("Failed to create attempt entry")

    # attempt_profiles_connection (INNER JOIN in attempt_mv — required)
    await conn.execute(
        """
        INSERT INTO attempt_profiles_connection (attempt_id, profiles_id, generated)
        VALUES ($1, $2, true)
        """,
        attempt_id,
        profiles_id,
    )

    return CreateAttemptResponse(id=attempt_id)

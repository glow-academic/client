"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_hint.types import CreateAttemptHintResponse


async def create_attempt_hint(
    conn: asyncpg.Connection,
    message_id: UUID,
    call_id: UUID,
    hint: str,
    mcp: bool = False,
) -> CreateAttemptHintResponse:
    """Create an attempt_hint entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_hint_entry
            (message_id, call_id, hint, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        message_id,
        call_id,
        hint,
        mcp,
    )

    return CreateAttemptHintResponse(id=entry_id)

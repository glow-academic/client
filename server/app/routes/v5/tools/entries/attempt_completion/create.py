"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_completion.types import (
    CreateAttemptCompletionResponse,
)


async def create_attempt_completion(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    call_id: UUID,
    stop: bool = False,
    error: bool = False,
    message: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptCompletionResponse:
    """Create a attempt_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_completion_entry (attempt_id, call_id, stop, error, message, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        attempt_id,
        call_id,
        stop,
        error,
        message,
        not soft,
        mcp,
    )
    return CreateAttemptCompletionResponse(id=entry_id)

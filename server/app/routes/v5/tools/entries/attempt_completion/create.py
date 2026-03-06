"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_completion.types import (
    CreateAttemptCompletionResponse,
)


async def create_attempt_completion(
    conn: asyncpg.Connection,
    chat_id: UUID,
    call_id: UUID,
    end_reason: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptCompletionResponse:
    """Create an attempt_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_completion_entry (chat_id, call_id, end_reason, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        chat_id,
        call_id,
        end_reason,
        not soft,
        mcp,
    )
    return CreateAttemptCompletionResponse(id=entry_id)

"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_conversations.types import (
    CreateAttemptConversationsResponse,
)


async def create_attempt_conversations(
    conn: asyncpg.Connection,
    chat_id: UUID,
    call_id: UUID,
    run_id: UUID,
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptConversationsResponse:
    """Create an attempt_conversations entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_conversations_entry (chat_id, call_id, run_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        chat_id,
        call_id,
        run_id,
        not soft,
        mcp,
    )
    return CreateAttemptConversationsResponse(id=entry_id)

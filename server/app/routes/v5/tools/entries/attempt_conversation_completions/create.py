"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_conversation_completions.types import (
    CreateAttemptConversationCompletionsResponse,
)


async def create_attempt_conversation_completions(
    conn: asyncpg.Connection,
    conversation_id: UUID,
    call_id: UUID,
    end_reason: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptConversationCompletionsResponse:
    """Create an attempt_conversation_completions entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_conversation_completions_entry (conversation_id, call_id, end_reason, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        conversation_id,
        call_id,
        end_reason,
        not soft,
        mcp,
    )
    return CreateAttemptConversationCompletionsResponse(id=entry_id)

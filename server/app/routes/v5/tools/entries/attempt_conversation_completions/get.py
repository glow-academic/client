"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_conversation_completions.types import (
    GetAttemptConversationCompletionsResponse,
)

MV_NAME = "attempt_conversation_completions_mv"


async def get_attempt_conversation_completions(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetAttemptConversationCompletionsResponse]:
    """Get attempt_conversation_completions entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetAttemptConversationCompletionsResponse(**dict(r)) for r in rows]

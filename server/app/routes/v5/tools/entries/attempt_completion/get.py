"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_completion.types import (
    GetAttemptCompletionResponse,
)

MV_NAME = "attempt_completion_mv"


async def get_attempt_completions(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetAttemptCompletionResponse]:
    """Get attempt_completion entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetAttemptCompletionResponse(**dict(r)) for r in rows]

"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_completion.types import (
    GetTestCompletionResponse,
)

MV_NAME = "test_completion_mv"


async def get_test_completions(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetTestCompletionResponse]:
    """Get test_completion entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetTestCompletionResponse(**dict(r)) for r in rows]

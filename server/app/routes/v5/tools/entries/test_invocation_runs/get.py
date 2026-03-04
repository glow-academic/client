"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_runs.types import (
    GetTestInvocationRunsResponse,
)

MV_NAME = "test_invocation_runs_mv"


async def get_test_invocation_runs(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetTestInvocationRunsResponse]:
    """Get test_invocation_runs entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetTestInvocationRunsResponse(**dict(r)) for r in rows]

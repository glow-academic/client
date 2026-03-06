"""Entry search — filtered/paginated query against test_invocation_runs_mv."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_runs.types import (
    GetTestInvocationRunsResponse,
)

MV_NAME = "test_invocation_runs_mv"


async def search_test_invocation_runs(
    conn: asyncpg.Connection,
    test_invocation_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetTestInvocationRunsResponse]:
    """Search test_invocation_runs from test_invocation_runs_mv with declarative filters."""
    rows = await conn.fetch(
        f"""
        SELECT *
        FROM {MV_NAME}
        WHERE ($1::uuid[] IS NULL OR test_invocation_id = ANY($1))
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        test_invocation_ids,
        limit,
        offset,
    )
    return [GetTestInvocationRunsResponse(**dict(r)) for r in rows]

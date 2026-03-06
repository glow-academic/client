"""Test completion search — filtered/paginated query against test_completion_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.test_completion.types import GetTestCompletionResponse

MV_NAME = "test_completion_mv"


async def search_test_completions(
    conn: asyncpg.Connection,
    invocation_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetTestCompletionResponse]:
    """Search test_completion entries from test_completion_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, generated, mcp, active, invocation_id, end_reason, call_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR invocation_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        invocation_id,
        limit,
        offset,
    )

    return [GetTestCompletionResponse(**dict(r)) for r in rows]

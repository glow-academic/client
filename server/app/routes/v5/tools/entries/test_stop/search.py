"""Test stop search — filtered/paginated query against test_stop_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.test_stop.types import GetTestStopResponse

MV_NAME = "test_stop_mv"


async def search_test_stops(
    conn: asyncpg.Connection,
    invocation_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetTestStopResponse]:
    """Search test_stop entries from test_stop_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, generated, mcp, active, invocation_id, stopped, call_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR invocation_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        invocation_id,
        limit,
        offset,
    )

    return [GetTestStopResponse(**dict(r)) for r in rows]

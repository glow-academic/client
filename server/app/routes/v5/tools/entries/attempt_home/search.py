"""Attempt home search — filtered/paginated query against attempt_home_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.attempt_home.types import GetAttemptHomeResponse

MV_NAME = "attempt_home_mv"


async def search_attempt_homes(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    home_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetAttemptHomeResponse]:
    """Search attempt_home entries from attempt_home_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT attempt_id, home_id, created_at, active, generated, mcp, session_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR attempt_id = $1)
          AND ($2::uuid IS NULL OR home_id = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        attempt_id,
        home_id,
        limit,
        offset,
    )

    return [GetAttemptHomeResponse(**dict(r)) for r in rows]

"""Grants search — filtered/paginated query against grants_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.grants.types import GetGrantResponse

MV_NAME = "grants_mv"


async def search_grants(
    conn: asyncpg.Connection,
    session_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetGrantResponse]:
    """Search grants from grants_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, session_id, expires_at, created_at, active, generated, mcp
        FROM {source}
        WHERE ($1::uuid IS NULL OR session_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        session_id,
        limit,
        offset,
    )

    return [GetGrantResponse(**dict(r)) for r in rows]

"""Grants search — filtered/paginated query against grants_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.grants.types import GetGrantResponse

MV_NAME = "grants_mv"


async def search_grants(
    conn: asyncpg.Connection,
    grantor_id: UUID | None = None,
    emulation_id: UUID | None = None,
    emulated_id: UUID | None = None,
    grant_session_id: UUID | None = None,
    emulation_session_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetGrantResponse]:
    """Search grants from grants_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT grant_id, grantor_id, emulation_id, emulated_id,
               grant_session_id, emulation_session_id,
               expires_at, used_at, revoked_at, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR grantor_id = $1)
          AND ($2::uuid IS NULL OR emulation_id = $2)
          AND ($3::uuid IS NULL OR emulated_id = $3)
          AND ($4::uuid IS NULL OR grant_session_id = $4)
          AND ($5::uuid IS NULL OR emulation_session_id = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        """,
        grantor_id,
        emulation_id,
        emulated_id,
        grant_session_id,
        emulation_session_id,
        limit,
        offset,
    )

    return [GetGrantResponse(**dict(r)) for r in rows]

"""Mutes search — filtered/paginated query against mutes_mv."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.mutes.types import GetMuteResponse

MV_NAME = "mutes_mv"


async def search_mutes(
    conn: asyncpg.Connection,
    conversation_id: UUID | None = None,
    muted: bool | None = None,
    call_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    mcp: bool | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetMuteResponse]:
    """Search mutes from mutes_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, generated, mcp, active, conversation_id, muted, call_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR conversation_id = $1)
          AND ($2::boolean IS NULL OR muted = $2)
          AND ($3::uuid IS NULL OR call_id = $3)
          AND ($4::timestamptz IS NULL OR created_at >= $4)
          AND ($5::timestamptz IS NULL OR created_at <= $5)
          AND ($6::boolean IS NULL OR mcp = $6)
        ORDER BY created_at DESC
        LIMIT $7 OFFSET $8
        """,
        conversation_id,
        muted,
        call_id,
        date_from,
        date_to,
        mcp,
        limit,
        offset,
    )

    return [
        GetMuteResponse(
            id=r["id"],
            created_at=r["created_at"],
            generated=r["generated"],
            mcp=r["mcp"],
            active=r["active"],
            conversation_id=r["conversation_id"],
            muted=r["muted"],
            call_id=r["call_id"],
        )
        for r in rows
    ]

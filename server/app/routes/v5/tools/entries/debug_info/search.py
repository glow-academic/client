"""Debug info search — filtered/paginated query against debug_info_mv."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.debug_info.types import GetDebugInfoResponse

MV_NAME = "debug_info_mv"


async def search_debug_info(
    conn: asyncpg.Connection,
    call_id: UUID | None = None,
    run_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    mcp: bool | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetDebugInfoResponse]:
    """Search debug_info from debug_info_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, content, active, generated, call_id, mcp, run_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR call_id = $1)
          AND ($2::uuid IS NULL OR run_id = $2)
          AND ($3::timestamptz IS NULL OR created_at >= $3)
          AND ($4::timestamptz IS NULL OR created_at <= $4)
          AND ($5::boolean IS NULL OR mcp = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        """,
        call_id,
        run_id,
        date_from,
        date_to,
        mcp,
        limit,
        offset,
    )

    return [
        GetDebugInfoResponse(
            id=r["id"],
            created_at=r["created_at"],
            content=r["content"],
            active=r["active"],
            generated=r["generated"],
            call_id=r["call_id"],
            mcp=r["mcp"],
            run_id=r["run_id"],
        )
        for r in rows
    ]

"""Debug info GET — batch get from debug_info_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.debug_info.types import GetDebugInfoResponse

MV_NAME = "debug_info_mv"


async def get_debug_info(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_mv: bool = False,
) -> list[GetDebugInfoResponse]:
    """Get debug_info entries by IDs from debug_info_mv."""
    if not ids:
        return []

    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, content, active, generated, call_id, mcp, run_id
        FROM {source}
        WHERE id = ANY($1)
        """,
        ids,
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

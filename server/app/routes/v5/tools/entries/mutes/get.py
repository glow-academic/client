"""Mutes GET — batch get from mutes_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.mutes.types import GetMuteResponse

MV_NAME = "mutes_mv"


async def get_mutes(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_mv: bool = False,
) -> list[GetMuteResponse]:
    """Get mutes by IDs from mutes_mv."""
    if not ids:
        return []

    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, generated, mcp, active, conversation_id, muted, call_id
        FROM {source}
        WHERE id = ANY($1)
        """,
        ids,
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

"""Sessions GET — batch get from sessions_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.sessions.types import GetSessionResponse


async def get_sessions(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetSessionResponse]:
    """Get sessions by IDs from sessions_mv."""
    if not ids:
        return []

    rows = await conn.fetch("""
        SELECT session_id, profile_id, session_created_at, active
        FROM sessions_mv
        WHERE session_id = ANY($1)
    """, ids)

    return [
        GetSessionResponse(
            id=r["session_id"],
            profile_id=r["profile_id"],
            created_at=r["session_created_at"],
            active=r["active"],
        )
        for r in rows
    ]

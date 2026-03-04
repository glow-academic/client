"""Sessions search — filtered/paginated query against sessions_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.sessions.types import GetSessionResponse


async def search_sessions(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetSessionResponse]:
    """Search sessions from sessions_mv with optional profile filter."""
    rows = await conn.fetch("""
        SELECT session_id, profile_id, session_created_at, active
        FROM sessions_mv
        WHERE ($1::uuid IS NULL OR profile_id = $1)
        ORDER BY session_created_at DESC
        LIMIT $2 OFFSET $3
    """, profile_id, limit, offset)

    return [
        GetSessionResponse(
            id=r["session_id"],
            profile_id=r["profile_id"],
            created_at=r["session_created_at"],
            active=r["active"],
        )
        for r in rows
    ]

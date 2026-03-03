"""Sessions GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.sessions.types import GetSessionResponse


async def get_session(
    conn: asyncpg.Connection,
    session_id: UUID,
    profile: bool = False,
) -> GetSessionResponse | None:
    """Get a sessions entry by ID, optionally including the linked profile."""
    if profile:
        row = await conn.fetchrow("""
            SELECT s.id, s.session_id, s.active, s.mcp, s.generated,
                   psc.profiles_id
            FROM sessions_entry s
            LEFT JOIN profiles_sessions_connection psc ON psc.session_id = s.id
            WHERE s.id = $1
        """, session_id)
    else:
        row = await conn.fetchrow("""
            SELECT id, session_id, active, mcp, generated
            FROM sessions_entry
            WHERE id = $1
        """, session_id)

    if row is None:
        return None

    return GetSessionResponse(
        id=row["id"],
        session_id=row["session_id"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
        profiles_id=row["profiles_id"] if profile else None,
    )

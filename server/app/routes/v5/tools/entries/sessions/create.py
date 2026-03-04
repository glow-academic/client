"""Sessions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.sessions.types import CreateSessionResponse


async def create_session(
    conn: asyncpg.Connection,
    profile_id: UUID,
    mcp: bool = False,
) -> CreateSessionResponse:
    """Create a sessions entry with profile link via connection table."""
    entry_id = await conn.fetchval("""
        INSERT INTO sessions_entry (mcp, generated)
        VALUES ($1, true)
        RETURNING id
    """, mcp)

    if entry_id is None:
        raise ValueError("Failed to create sessions entry")

    # Link session → profile via connection table
    await conn.execute("""
        INSERT INTO profiles_sessions_connection (profiles_id, session_id)
        VALUES ($1, $2)
    """, profile_id, entry_id)

    return CreateSessionResponse(id=entry_id)

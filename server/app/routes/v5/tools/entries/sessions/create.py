"""Sessions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.sessions.types import CreateSessionResponse


async def create_session(
    conn: asyncpg.Connection,
    session_id: UUID,
    profile_id: UUID,
    mcp: bool = False,
) -> CreateSessionResponse:
    """Create a sessions entry."""
    entry_id = await conn.fetchval("""
        INSERT INTO sessions_entry (session_id, profile_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, session_id, profile_id, mcp)

    if entry_id is None:
        raise ValueError("Failed to create sessions entry")

    return CreateSessionResponse(id=entry_id)

"""Grants CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.grants.types import CreateGrantResponse


async def create_grant(
    conn: asyncpg.Connection,
    session_id: UUID,
    expires_at: str = "2099-12-31T23:59:59Z",
    mcp: bool = False,
) -> CreateGrantResponse:
    """Create a grants entry."""
    grant_id = await conn.fetchval(
        """
        INSERT INTO grants_entry (session_id, expires_at, mcp, generated)
        VALUES ($1, $2::timestamptz, $3, true)
        RETURNING id
        """,
        session_id,
        expires_at,
        mcp,
    )

    if grant_id is None:
        raise ValueError("Failed to create grants entry")

    return CreateGrantResponse(id=grant_id)

"""Grants CREATE — reusable data-access layer."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.grants.types import CreateGrantResponse


async def create_grant(
    conn: asyncpg.Connection,
    session_id: UUID,
    id: UUID | None = None,
    expires_at: datetime | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreateGrantResponse:
    """Create a grants entry. Defaults to 1 hour expiry if not specified."""
    if expires_at is None:
        expires_at = datetime.now(UTC) + timedelta(hours=1)

    grant_id = await conn.fetchval(
        """
        INSERT INTO grants_entry (id, session_id, expires_at, active, mcp, generated)
        VALUES (COALESCE($5, uuidv7()), $1, $2, $3, $4, true)
        RETURNING id
        """,
        session_id,
        expires_at,
        not soft,
        mcp,
        id,
    )

    if grant_id is None:
        raise ValueError("Failed to create grants entry")

    return CreateGrantResponse(id=grant_id)

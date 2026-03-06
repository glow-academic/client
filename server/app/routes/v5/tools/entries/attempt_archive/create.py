"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_archive.types import (
    CreateAttemptArchiveResponse,
)


async def create_attempt_archive(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    call_id: UUID,
    archived: bool,
    mcp: bool = False,
    soft: bool = False,
) -> CreateAttemptArchiveResponse:
    """Create an attempt_archive entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_archive_entry (attempt_id, call_id, archived, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        attempt_id,
        call_id,
        archived,
        not soft,
        mcp,
    )
    return CreateAttemptArchiveResponse(id=entry_id)

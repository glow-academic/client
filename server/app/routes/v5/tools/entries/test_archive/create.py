"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_archive.types import (
    CreateTestArchiveResponse,
)


async def create_test_archive(
    conn: asyncpg.Connection,
    test_id: UUID,
    call_id: UUID,
    archived: bool,
    mcp: bool = False,
) -> CreateTestArchiveResponse:
    """Create a test_archive entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_archive_entry (test_id, call_id, archived, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        test_id,
        call_id,
        archived,
        mcp,
    )
    return CreateTestArchiveResponse(id=entry_id)

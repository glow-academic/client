"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_stop.types import (
    CreateTestStopResponse,
)


async def create_test_stop(
    conn: asyncpg.Connection,
    invocation_id: UUID,
    call_id: UUID,
    stopped: bool,
    mcp: bool = False,
) -> CreateTestStopResponse:
    """Create a test_stop entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_stop_entry (invocation_id, call_id, stopped, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        invocation_id,
        call_id,
        stopped,
        mcp,
    )
    return CreateTestStopResponse(id=entry_id)

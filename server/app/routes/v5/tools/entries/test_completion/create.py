"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_completion.types import (
    CreateTestCompletionResponse,
)


async def create_test_completion(
    conn: asyncpg.Connection,
    test_id: UUID,
    call_id: UUID,
    stop: bool = False,
    error: bool = False,
    message: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateTestCompletionResponse:
    """Create a test_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_completion_entry (test_id, call_id, stop, error, message, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        test_id,
        call_id,
        stop,
        error,
        message,
        not soft,
        mcp,
    )
    return CreateTestCompletionResponse(id=entry_id)

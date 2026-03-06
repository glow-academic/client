"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_completion.types import (
    CreateTestCompletionResponse,
)


async def create_test_completion(
    conn: asyncpg.Connection,
    invocation_id: UUID,
    call_id: UUID,
    end_reason: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateTestCompletionResponse:
    """Create a test_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_completion_entry (invocation_id, call_id, end_reason, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        invocation_id,
        call_id,
        end_reason,
        not soft,
        mcp,
    )
    return CreateTestCompletionResponse(id=entry_id)

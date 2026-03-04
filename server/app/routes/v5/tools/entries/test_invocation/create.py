"""Test invocation CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.test_invocation.types import (
    CreateTestInvocationResponse,
)


async def create_test_invocation(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    call_id: UUID | None = None,
    title: str = "",
    group_id: UUID | None = None,
    use_custom: bool = False,
    position: int = 0,
    config_signature: str | None = None,
    mcp: bool = False,
) -> CreateTestInvocationResponse:
    """Create a test_invocation_entry row."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_invocation_entry (
            test_id, call_id, title, group_id,
            use_custom, "position", config_signature, mcp, generated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING id
        """,
        test_id,
        call_id,
        title,
        group_id,
        use_custom,
        position,
        config_signature,
        mcp,
    )

    if entry_id is None:
        raise ValueError("Failed to create test_invocation entry")

    return CreateTestInvocationResponse(id=entry_id)

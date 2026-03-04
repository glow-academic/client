"""Test invocation bridge CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.test_invocation_bridge.types import (
    CreateTestInvocationBridgeResponse,
)


async def create_test_invocation_bridge(
    conn: asyncpg.Connection,
    test_invocation_id: UUID,
    invocation_id: UUID,
    session_id: UUID | None = None,
    mcp: bool = False,
) -> CreateTestInvocationBridgeResponse:
    """Create a test_invocation_bridge_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO test_invocation_bridge_entry (test_invocation_id, invocation_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        """,
        test_invocation_id,
        invocation_id,
        session_id,
        mcp,
    )

    return CreateTestInvocationBridgeResponse(
        test_invocation_id=test_invocation_id, invocation_id=invocation_id
    )

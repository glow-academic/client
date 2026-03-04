"""Invocation CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.invocation.types import CreateInvocationResponse


async def create_invocation(
    conn: asyncpg.Connection,
    benchmark_id: UUID,
    session_id: UUID | None = None,
    use_custom: bool = False,
    position: int = 0,
    mcp: bool = False,
) -> CreateInvocationResponse:
    """Create an invocation entry."""
    invocation_id = await conn.fetchval(
        """
        INSERT INTO invocation_entry (benchmark_id, session_id, use_custom, "position", mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        benchmark_id,
        session_id,
        use_custom,
        position,
        mcp,
    )

    if invocation_id is None:
        raise ValueError("Failed to create invocation entry")

    return CreateInvocationResponse(id=invocation_id)

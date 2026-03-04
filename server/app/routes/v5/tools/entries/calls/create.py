"""Calls CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.calls.types import CreateCallResponse


async def create_call(
    conn: asyncpg.Connection,
    run_id: UUID,
    session_id: UUID,
    external_call_id: str = "",
    tool_id: UUID | None = None,
    mcp: bool = False,
) -> CreateCallResponse:
    """Create a calls entry with optional tool link."""
    call_id = await conn.fetchval("""
        INSERT INTO calls_entry (run_id, session_id, external_call_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
    """, run_id, session_id, external_call_id, mcp)

    if call_id is None:
        raise ValueError("Failed to create calls entry")

    # Link call → tools_resource
    if tool_id is not None:
        await conn.execute("""
            INSERT INTO tools_calls_connection (tools_id, call_id)
            VALUES ($1, $2)
        """, tool_id, call_id)

    return CreateCallResponse(id=call_id)

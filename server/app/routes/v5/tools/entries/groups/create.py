"""Groups CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.groups.types import CreateGroupResponse


async def create_group(
    conn: asyncpg.Connection,
    session_id: UUID,
    name: str = "",
    mcp: bool = False,
) -> CreateGroupResponse:
    """Create a groups entry."""
    group_id = await conn.fetchval("""
        INSERT INTO groups_entry (session_id, name, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, session_id, name, mcp)

    if group_id is None:
        raise ValueError("Failed to create groups entry")

    return CreateGroupResponse(id=group_id)

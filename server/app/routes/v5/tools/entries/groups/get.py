"""Groups GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.groups.types import GetGroupResponse


async def get_group(
    conn: asyncpg.Connection,
    group_id: UUID,
) -> GetGroupResponse | None:
    """Get a groups entry by ID."""
    row = await conn.fetchrow("""
        SELECT id, session_id, name, active, mcp, generated
        FROM groups_entry
        WHERE id = $1
    """, group_id)

    if row is None:
        return None

    return GetGroupResponse(
        id=row["id"],
        session_id=row["session_id"],
        name=row["name"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
    )

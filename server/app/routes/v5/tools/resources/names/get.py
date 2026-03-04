"""Names Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.names.types import GetNameResponse


async def get_name(
    conn: asyncpg.Connection,
    name_id: UUID,
) -> GetNameResponse | None:
    """Get a names_resource entry by ID."""
    row = await conn.fetchrow("""
        SELECT id, name, created_at, active, mcp, generated
        FROM names_resource
        WHERE id = $1
    """, name_id)

    if row is None:
        return None

    return GetNameResponse(
        id=row["id"],
        name=row["name"],
        created_at=row["created_at"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
    )

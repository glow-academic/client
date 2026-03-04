"""Names Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.names.types import GetNameResponse


async def get_names(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetNameResponse]:
    """Fetch names_resource entries by IDs."""
    if not ids:
        return []

    rows = await conn.fetch("""
        SELECT id, name, created_at, active, mcp, generated
        FROM names_resource
        WHERE id = ANY($1)
        ORDER BY array_position($1, id)
    """, ids)

    return [
        GetNameResponse(
            id=r["id"],
            name=r["name"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

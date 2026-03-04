"""Args Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.args.types import GetArgResponse


async def get_args(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetArgResponse]:
    """Fetch args_resource entries by IDs."""
    if not ids:
        return []

    rows = await conn.fetch("""
        SELECT id, name, description, field_type, required, default_value,
               created_at, active, mcp, generated
        FROM args_resource
        WHERE id = ANY($1)
        ORDER BY array_position($1, id)
    """, ids)

    return [
        GetArgResponse(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            field_type=r["field_type"],
            required=r["required"],
            default_value=r["default_value"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

"""Args Outputs Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.args_outputs.types import GetArgOutputResponse


async def get_args_outputs(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetArgOutputResponse]:
    """Fetch args_outputs_resource entries by IDs."""
    if not ids:
        return []

    rows = await conn.fetch("""
        SELECT id, args_id, name, template,
               created_at, active, mcp, generated
        FROM args_outputs_resource
        WHERE id = ANY($1)
        ORDER BY array_position($1, id)
    """, ids)

    return [
        GetArgOutputResponse(
            id=r["id"],
            args_id=r["args_id"],
            name=r["name"],
            template=r["template"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

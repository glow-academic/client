"""Tools Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.tools.types import GetToolResponse


async def get_tools(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetToolResponse]:
    """Fetch tools_resource entries by IDs."""
    if not ids:
        return []

    rows = await conn.fetch("""
        SELECT id, name, description, operation,
               department_ids, args_ids, args_output_ids,
               resources, entries, artifacts,
               created_at, active, mcp, generated
        FROM tools_resource
        WHERE id = ANY($1)
        ORDER BY array_position($1, id)
    """, ids)

    return [
        GetToolResponse(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            operation=r["operation"],
            department_ids=r["department_ids"] or [],
            args_ids=r["args_ids"] or [],
            args_output_ids=r["args_output_ids"] or [],
            resources=r["resources"] or [],
            entries=r["entries"] or [],
            artifacts=r["artifacts"] or [],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

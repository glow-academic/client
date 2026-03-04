"""Tools Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.tools.types import GetToolResponse


async def get_tool(
    conn: asyncpg.Connection,
    tool_id: UUID,
) -> GetToolResponse | None:
    """Get a tools_resource entry by ID."""
    row = await conn.fetchrow("""
        SELECT id, name, description, operation,
               department_ids, args_ids, args_output_ids,
               resources, entries, artifacts,
               created_at, active, mcp, generated
        FROM tools_resource
        WHERE id = $1
    """, tool_id)

    if row is None:
        return None

    return GetToolResponse(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        operation=row["operation"],
        department_ids=row["department_ids"] or [],
        args_ids=row["args_ids"] or [],
        args_output_ids=row["args_output_ids"] or [],
        resources=row["resources"] or [],
        entries=row["entries"] or [],
        artifacts=row["artifacts"] or [],
        created_at=row["created_at"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
    )

"""Names CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import record_call_args, resolve_tool
from app.routes.v5.tools.resources.names.types import CreateNameResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_name(
    conn: asyncpg.Connection,
    name: str,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateNameResponse:
    """Create a name resource (get-or-create). Returns name_id and optional call_id."""
    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool(conn, "create", "names", scope="resources")
        if tool_info:
            tool_id = tool_info.tool_id

    # Check if name already exists
    existing = await conn.fetchval("""
        SELECT id FROM names_resource WHERE name = $1 LIMIT 1
    """, name)

    if existing is not None:
        return CreateNameResponse(name_id=existing)

    # Insert new name
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
    """, name, mcp)

    # Create tracking records if tool_id and group_id provided
    call_id = None
    if tool_id is not None and group_id is not None:
        call_id = await conn.fetchval("""
            WITH new_run AS (
                INSERT INTO runs_entry (id, group_id, created_at, updated_at)
                VALUES (uuidv7(), $1, NOW(), NOW())
                RETURNING id
            ),
            new_call AS (
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                SELECT uuidv7(), 'names_' || uuidv7()::text, new_run.id, NOW()
                FROM new_run
                RETURNING id
            ),
            link_tool AS (
                INSERT INTO tools_calls_connection (tools_id, call_id)
                SELECT $2, new_call.id FROM new_call
            ),
            link_name AS (
                INSERT INTO names_calls_connection (names_id, call_id)
                SELECT $3, new_call.id FROM new_call
            )
            SELECT new_call.id FROM new_call
        """, group_id, tool_id, name_id)

    # Record arg values
    if tool_info is None and tool_id is not None:
        tool_info = await resolve_tool(conn, "create", "names", scope="resources")
    if tool_info and call_id is not None:
        await record_call_args(conn, call_id, tool_info, {"name": name}, mcp)

    await invalidate_tags(["resources", "names"])
    return CreateNameResponse(name_id=name_id, call_id=call_id)

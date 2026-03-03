"""Names CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import record_call_args, resolve_tool
from app.routes.v5.tools.resources.names.types import CreateNameResponse
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql

FIND_SQL = "app/sql/queries/resources/names/find_name.sql"
INSERT_SQL = "app/sql/queries/resources/names/insert_name.sql"
TRACKING_SQL = "app/sql/queries/resources/names/insert_name_tracking.sql"


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
    existing = await conn.fetchval(load_sql(FIND_SQL), name)
    if existing is not None:
        return CreateNameResponse(name_id=existing)

    # Insert new name
    name_id = await conn.fetchval(load_sql(INSERT_SQL), name, mcp)

    # Create tracking records if tool_id and group_id provided
    call_id = None
    if tool_id is not None and group_id is not None:
        call_id = await conn.fetchval(load_sql(TRACKING_SQL), group_id, tool_id, name_id)

    # Record arg values
    if tool_info is None and tool_id is not None:
        tool_info = await resolve_tool(conn, "create", "names", scope="resources")
    if tool_info and call_id is not None:
        await record_call_args(conn, call_id, tool_info, {"name": name}, mcp)

    await invalidate_tags(["resources", "names"])
    return CreateNameResponse(name_id=name_id, call_id=call_id)

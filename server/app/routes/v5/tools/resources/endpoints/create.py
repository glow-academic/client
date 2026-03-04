"""endpoints/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import record_call_args, resolve_tool
from app.sql.types import (
    EndpointsSqlParams,
    EndpointsSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/endpoints_complete.sql"

async def create_endpoints_internal(
    conn: asyncpg.Connection,
    base_url: str,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> UUID:
    """Create an endpoint resource and return its ID.

    When group_id is provided, creates run/call/tool tracking records.
    Tool is auto-resolved if tool_id is not provided.
    """
    # Resolve tool if not provided (canonical — matches entry pattern)
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool(conn, "create", "endpoints", scope="resources")
        if tool_info:
            tool_id = tool_info.tool_id

    params = EndpointsSqlParams(
        base_url=base_url, mcp=mcp, group_id=group_id, tool_id=tool_id
    )
    result = cast(
        EndpointsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.endpoints_id:
        raise ValueError(f"Failed to create endpoint: {base_url}")

    # Record arg values (canonical — matches entry pattern)
    if tool_info is None and tool_id is not None:
        tool_info = await resolve_tool(conn, "create", "endpoints", scope="resources")
    if tool_info and result.call_id is not None:
        await record_call_args(
            conn, result.call_id, tool_info, {"base_url": base_url}, mcp
        )

    await invalidate_tags(["resources", "endpoints"], redis=get_redis_client())
    return result.endpoints_id

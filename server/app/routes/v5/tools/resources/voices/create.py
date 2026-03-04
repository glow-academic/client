"""voices/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import record_call_args, resolve_tool
from app.sql.types import (
    VoicesSqlParams,
    VoicesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/voices_complete.sql"

async def create_voices_internal(
    conn: asyncpg.Connection,
    voice: str,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> UUID:
    """Create a voice resource and return its ID.

    When group_id is provided, creates run/call/tool tracking records.
    Tool is auto-resolved if tool_id is not provided.
    """
    # Resolve tool if not provided (canonical — matches entry pattern)
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool(conn, "create", "voices", scope="resources")
        if tool_info:
            tool_id = tool_info.tool_id

    params = VoicesSqlParams(voice=voice, mcp=mcp, group_id=group_id, tool_id=tool_id)
    result = cast(
        VoicesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.voices_id:
        raise ValueError(f"Failed to create voice: {voice}")

    # Record arg values (canonical — matches entry pattern)
    if tool_info is None and tool_id is not None:
        tool_info = await resolve_tool(conn, "create", "voices", scope="resources")
    if tool_info and result.call_id is not None:
        await record_call_args(conn, result.call_id, tool_info, {"voice": voice}, mcp)

    await invalidate_tags(["resources", "voices"], redis=get_redis_client())
    return result.voices_id

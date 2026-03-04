"""attempt_home/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import record_call_args, resolve_tool_for_entry
from app.routes.v5.api.entries.attempt_home.types import (
    CreateAttemptHomeEntryResponse,
    CreateAttemptHomeEntrySqlParams,
    CreateAttemptHomeEntrySqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed
from app.utils.storage.file_writer import write_text_file

SQL_PATH = (
    "app/sql/queries/entries/attempt_home/create_attempt_home_entries_complete.sql"
)

ENTRY_TYPE = "attempt_homes"

async def create_attempt_home_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateAttemptHomeEntryResponse:
    """Internal function to create attempt_home bridge entry."""
    tags = ["entries", "attempt_home"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created attempt home entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateAttemptHomeEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptHomeEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_home entry")

        # Record arg values via connection pattern
        if tool_info is None and tool_id is not None:
            tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            await record_call_args(conn, result.call_id, tool_info, request_dict, mcp)

    await invalidate_tags(tags, redis=get_redis_client())

    return CreateAttemptHomeEntryResponse.model_validate(result.model_dump())

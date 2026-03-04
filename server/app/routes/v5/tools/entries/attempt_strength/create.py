"""attempt_strength/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.call_args import resolve_tool_for_entry
from app.routes.v5.api.entries.attempt_strength.types import (
    CreateAttemptStrengthEntryResponse,
    CreateAttemptStrengthEntrySqlParams,
    CreateAttemptStrengthEntrySqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed
from app.utils.storage.file_writer import write_text_file

SQL_PATH = "app/sql/queries/entries/attempt_strength/create_attempt_strength_entries_complete.sql"

ENTRY_TYPE = "strengths"

async def create_attempt_strength_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateAttemptStrengthEntryResponse:
    """Internal function to create attempt_strength entry.

    Internal callers can pass run_id and tool_id directly.
    If not provided, tool is resolved from settings via operation + entry type.
    """
    tags = ["entries", "attempt_strength"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created attempt strength entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateAttemptStrengthEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptStrengthEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.entry_id:
            raise ValueError("Failed to create attempt_strength entry")

    await invalidate_tags(tags, redis=get_redis_client())

    return CreateAttemptStrengthEntryResponse(
        id=result.entry_id,
        call_id=result.entry_call_id,
        message_id=result.entry_message_id,
    )

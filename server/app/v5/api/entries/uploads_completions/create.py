"""Internal uploads_completions entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.uploads_completions.types import (
    CreateUploadsCompletionsEntryResponse,
    CreateUploadsCompletionsEntrySqlParams,
    CreateUploadsCompletionsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/uploads_completions/create_uploads_completions_entries_complete.sql"


async def create_uploads_completions_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    upload_id: UUID,
    end_reason: str = "",
    mcp: bool = False,
) -> CreateUploadsCompletionsEntryResponse:
    """Create a uploads_completions entry. Internal only — no HTTP route."""
    params = CreateUploadsCompletionsEntrySqlParams(
        session_id=session_id, upload_id=upload_id, end_reason=end_reason, mcp=mcp
    )

    result = cast(
        CreateUploadsCompletionsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create uploads_completions entry")

    return CreateUploadsCompletionsEntryResponse.model_validate(result.model_dump())

"""Internal activity entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.activity.types import (
    CreateActivityEntryResponse,
    CreateActivityEntrySqlParams,
    CreateActivityEntrySqlRow,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/activity/create_activity_entries_complete.sql"


async def create_activity_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateActivityEntryResponse:
    """Create a activity entry. Internal only — no HTTP route."""
    params = CreateActivityEntrySqlParams(session_id=session_id, mcp=mcp)

    result = cast(
        CreateActivityEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create activity entry")

    return CreateActivityEntryResponse.model_validate(result.model_dump())

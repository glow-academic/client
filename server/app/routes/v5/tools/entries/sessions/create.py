"""sessions/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.sessions.types import (
    CreateSessionsEntryResponse,
    CreateSessionsEntrySqlParams,
    CreateSessionsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/sessions/create_sessions_entries_complete.sql"

async def create_sessions_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    profile_id: UUID,
    mcp: bool = False,
) -> CreateSessionsEntryResponse:
    """Create a sessions entry. Internal only — no HTTP route."""
    params = CreateSessionsEntrySqlParams(
        session_id=session_id, profile_id=profile_id, mcp=mcp
    )

    result = cast(
        CreateSessionsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create sessions entry")

    return CreateSessionsEntryResponse.model_validate(result.model_dump())

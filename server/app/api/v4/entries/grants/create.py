"""Internal grants entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.grants.types import (
    CreateGrantsEntryResponse,
    CreateGrantsEntrySqlParams,
    CreateGrantsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/grants/create_grants_entries_complete.sql"


async def create_grants_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    expires_at: str,
    mcp: bool = False,
) -> CreateGrantsEntryResponse:
    """Create a grants entry. Internal only — no HTTP route."""
    params = CreateGrantsEntrySqlParams(
        session_id=session_id, expires_at=expires_at, mcp=mcp
    )

    result = cast(
        CreateGrantsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create grants entry")

    return CreateGrantsEntryResponse.model_validate(result.model_dump())

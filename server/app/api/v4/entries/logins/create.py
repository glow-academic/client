"""Internal logins entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.logins.types import (
    CreateLoginsEntryResponse,
    CreateLoginsEntrySqlParams,
    CreateLoginsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/logins/create_logins_entries_complete.sql"


async def create_logins_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateLoginsEntryResponse:
    """Create a logins entry. Internal only — no HTTP route."""
    params = CreateLoginsEntrySqlParams(session_id=session_id, mcp=mcp)

    result = cast(
        CreateLoginsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create logins entry")

    return CreateLoginsEntryResponse.model_validate(result.model_dump())

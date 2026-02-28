"""Internal audits entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.audits.types import (
    CreateAuditsEntryResponse,
    CreateAuditsEntrySqlParams,
    CreateAuditsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/audits/create_audits_entries_complete.sql"


async def create_audits_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    message: str,
    endpoint: str,
    error: bool = False,
    mcp: bool = False,
) -> CreateAuditsEntryResponse:
    """Create a audits entry. Internal only — no HTTP route."""
    params = CreateAuditsEntrySqlParams(
        session_id=session_id, message=message, endpoint=endpoint, error=error, mcp=mcp
    )

    result = cast(
        CreateAuditsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create audits entry")

    return CreateAuditsEntryResponse.model_validate(result.model_dump())

"""calls/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.calls.types import (
    CreateCallsEntryResponse,
    CreateCallsEntrySqlParams,
    CreateCallsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/calls/create_calls_entries_complete.sql"

async def create_calls_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    external_call_id: str,
    run_id: UUID | None = None,
    mcp: bool = False,
) -> CreateCallsEntryResponse:
    """Create a calls entry. Internal only — no HTTP route."""
    params = CreateCallsEntrySqlParams(
        session_id=session_id, external_call_id=external_call_id, run_id=run_id, mcp=mcp
    )

    result = cast(
        CreateCallsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create calls entry")

    return CreateCallsEntryResponse.model_validate(result.model_dump())

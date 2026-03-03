"""Internal emulations entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.emulations.types import (
    CreateEmulationsEntryResponse,
    CreateEmulationsEntrySqlParams,
    CreateEmulationsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/entries/emulations/create_emulations_entries_complete.sql"
)


async def create_emulations_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    grant_id: UUID,
    mcp: bool = False,
) -> CreateEmulationsEntryResponse:
    """Create a emulations entry. Internal only — no HTTP route."""
    params = CreateEmulationsEntrySqlParams(
        session_id=session_id, grant_id=grant_id, mcp=mcp
    )

    result = cast(
        CreateEmulationsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create emulations entry")

    return CreateEmulationsEntryResponse.model_validate(result.model_dump())

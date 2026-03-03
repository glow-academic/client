"""Internal files entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.files.types import (
    CreateFilesEntryResponse,
    CreateFilesEntrySqlParams,
    CreateFilesEntrySqlRow,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/files/create_files_entries_complete.sql"


async def create_files_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateFilesEntryResponse:
    """Create a files entry. Internal only — no HTTP route."""
    params = CreateFilesEntrySqlParams(
        session_id=session_id,
        mcp=mcp,
    )

    result = cast(
        CreateFilesEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create files entry")

    return CreateFilesEntryResponse.model_validate(result.model_dump())

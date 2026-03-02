"""Internal texts entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.texts.types import (
    CreateTextsEntryResponse,
    CreateTextsEntrySqlParams,
    CreateTextsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/texts/create_texts_entries_complete.sql"


async def create_texts_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateTextsEntryResponse:
    """Create a texts entry. Internal only — no HTTP route."""
    params = CreateTextsEntrySqlParams(session_id=session_id, mcp=mcp)

    result = cast(
        CreateTextsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create texts entry")

    return CreateTextsEntryResponse.model_validate(result.model_dump())

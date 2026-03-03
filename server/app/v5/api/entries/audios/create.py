"""Internal audios entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.audios.types import (
    CreateAudiosEntryResponse,
    CreateAudiosEntrySqlParams,
    CreateAudiosEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/audios/create_audios_entries_complete.sql"


async def create_audios_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    message_id: UUID | None = None,
    length_seconds: int = 0,
    mcp: bool = False,
) -> CreateAudiosEntryResponse:
    """Create a audios entry. Internal only — no HTTP route."""
    params = CreateAudiosEntrySqlParams(
        session_id=session_id,
        message_id=message_id,
        length_seconds=length_seconds,
        mcp=mcp,
    )

    result = cast(
        CreateAudiosEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create audios entry")

    return CreateAudiosEntryResponse.model_validate(result.model_dump())

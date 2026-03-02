"""Internal videos entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.videos.types import (
    CreateVideosEntryResponse,
    CreateVideosEntrySqlParams,
    CreateVideosEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/videos/create_videos_entries_complete.sql"


async def create_videos_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    message_id: UUID | None = None,
    length_seconds: int = 0,
    mcp: bool = False,
) -> CreateVideosEntryResponse:
    """Create a videos entry. Internal only — no HTTP route."""
    params = CreateVideosEntrySqlParams(
        session_id=session_id,
        message_id=message_id,
        length_seconds=length_seconds,
        mcp=mcp,
    )

    result = cast(
        CreateVideosEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create videos entry")

    return CreateVideosEntryResponse.model_validate(result.model_dump())

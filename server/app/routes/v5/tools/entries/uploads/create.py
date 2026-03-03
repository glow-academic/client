"""uploads/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.uploads.types import (
    CreateUploadsEntryResponse,
    CreateUploadsEntrySqlParams,
    CreateUploadsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/uploads/create_uploads_entries_complete.sql"

async def create_uploads_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    file_path: str,
    mime_type: str,
    size: int,
    mcp: bool = False,
) -> CreateUploadsEntryResponse:
    """Create a uploads entry. Internal only — no HTTP route."""
    params = CreateUploadsEntrySqlParams(
        session_id=session_id,
        file_path=file_path,
        mime_type=mime_type,
        size=size,
        mcp=mcp,
    )

    result = cast(
        CreateUploadsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create uploads entry")

    return CreateUploadsEntryResponse.model_validate(result.model_dump())

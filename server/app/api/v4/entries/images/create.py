"""Internal images entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.images.types import (
    CreateImagesEntryResponse,
    CreateImagesEntrySqlParams,
    CreateImagesEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/images/create_images_entries_complete.sql"


async def create_images_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    upload_id: UUID | None = None,
    message_id: UUID | None = None,
    mcp: bool = False,
) -> CreateImagesEntryResponse:
    """Create a images entry. Internal only — no HTTP route."""
    params = CreateImagesEntrySqlParams(
        session_id=session_id, upload_id=upload_id, message_id=message_id, mcp=mcp
    )

    result = cast(
        CreateImagesEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create images entry")

    return CreateImagesEntryResponse.model_validate(result.model_dump())

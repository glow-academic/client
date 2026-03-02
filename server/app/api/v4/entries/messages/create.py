"""Internal messages entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.messages.types import (
    CreateMessagesEntryResponse,
    CreateMessagesEntrySqlParams,
    CreateMessagesEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/messages/create_messages_entries_complete.sql"


async def create_messages_entry_internal(
    conn: asyncpg.Connection,
    run_id: UUID,
    role: str,
    chat_id: UUID | None = None,
    mcp: bool = False,
) -> CreateMessagesEntryResponse:
    """Create a messages entry with optional attempt_message_entry link.

    If chat_id is provided, also inserts into attempt_message_entry.
    """
    params = CreateMessagesEntrySqlParams(
        run_id=run_id,
        role=role,
        chat_id=chat_id,
        mcp=mcp,
    )

    result = cast(
        CreateMessagesEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create messages entry")

    return CreateMessagesEntryResponse.model_validate(result.model_dump())

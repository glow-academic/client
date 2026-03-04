"""messages_completions/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.messages_completions.types import (
    CreateMessagesCompletionsEntryResponse,
    CreateMessagesCompletionsEntrySqlParams,
    CreateMessagesCompletionsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/messages_completions/create_messages_completions_entries_complete.sql"


async def create_messages_completions_entry_internal(
    conn: asyncpg.Connection,
    message_id: UUID,
    session_id: UUID | None = None,
    mcp: bool = False,
) -> CreateMessagesCompletionsEntryResponse:
    """Create a messages_completions entry. Internal only — no HTTP route."""
    params = CreateMessagesCompletionsEntrySqlParams(
        session_id=session_id, message_id=message_id, mcp=mcp
    )

    result = cast(
        CreateMessagesCompletionsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create messages_completions entry")

    return CreateMessagesCompletionsEntryResponse.model_validate(result.model_dump())

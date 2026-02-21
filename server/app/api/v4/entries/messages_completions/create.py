"""Messages Completions entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateMessagesCompletionsEntriesApiResponse,
    CreateMessagesCompletionsEntriesSqlParams,
    CreateMessagesCompletionsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/messages_completions/create_messages_completions_entries_complete.sql"


async def create_messages_completions_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateMessagesCompletionsEntriesApiResponse:
    """Internal function to create messages_completions entry."""
    tags = ["entries", "messages_completions"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateMessagesCompletionsEntriesSqlParams(**request_dict)

        result = cast(
            CreateMessagesCompletionsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create messages_completions entry")

    await invalidate_tags(tags)

    return CreateMessagesCompletionsEntriesApiResponse.model_validate(
        result.model_dump()
    )

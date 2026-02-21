"""Conversations Completions entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateConversationsCompletionsEntriesApiResponse,
    CreateConversationsCompletionsEntriesSqlParams,
    CreateConversationsCompletionsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/conversations_completions/create_conversations_completions_entries_complete.sql"


async def create_conversations_completions_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateConversationsCompletionsEntriesApiResponse:
    """Internal function to create conversations_completions entry."""
    tags = ["entries", "conversations_completions"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateConversationsCompletionsEntriesSqlParams(**request_dict)

        result = cast(
            CreateConversationsCompletionsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create conversations_completions entry")

    await invalidate_tags(tags)

    return CreateConversationsCompletionsEntriesApiResponse.model_validate(
        result.model_dump()
    )

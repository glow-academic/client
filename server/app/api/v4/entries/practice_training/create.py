"""Practice Chat entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePracticeChatEntriesApiResponse,
    CreatePracticeChatEntriesSqlParams,
    CreatePracticeChatEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/practice_chat/create_practice_chat_entries_complete.sql"
)


async def create_practice_training_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePracticeChatEntriesApiResponse:
    """Internal function to create practice_chat entry."""
    tags = ["entries", "practice_chat"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePracticeChatEntriesSqlParams(**request_dict)

        result = cast(
            CreatePracticeChatEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create practice_chat entry")

    await invalidate_tags(tags)

    return CreatePracticeChatEntriesApiResponse.model_validate(result.model_dump())

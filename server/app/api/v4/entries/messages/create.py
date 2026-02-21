"""Messages entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateMessagesEntriesApiResponse,
    CreateMessagesEntriesSqlParams,
    CreateMessagesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/messages/create_messages_entries_complete.sql"


async def create_messages_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateMessagesEntriesApiResponse:
    """Internal function to create messages entry."""
    tags = ["entries", "messages"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateMessagesEntriesSqlParams(**request_dict)

        result = cast(
            CreateMessagesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create messages entry")

    await invalidate_tags(tags)

    return CreateMessagesEntriesApiResponse.model_validate(result.model_dump())

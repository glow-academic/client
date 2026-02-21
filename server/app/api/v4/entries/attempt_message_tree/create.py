"""Attempt Message Tree entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptMessageTreeEntriesApiResponse,
    CreateAttemptMessageTreeEntriesSqlParams,
    CreateAttemptMessageTreeEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_message_tree/create_attempt_message_tree_entries_complete.sql"


async def create_attempt_message_tree_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptMessageTreeEntriesApiResponse:
    """Internal function to create attempt_message_tree entry."""
    tags = ["entries", "attempt_message_tree"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptMessageTreeEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptMessageTreeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_message_tree entry")

    await invalidate_tags(tags)

    return CreateAttemptMessageTreeEntriesApiResponse.model_validate(
        result.model_dump()
    )

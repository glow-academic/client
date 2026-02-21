"""Attempt Hint entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptHintEntriesApiResponse,
    CreateAttemptHintEntriesSqlParams,
    CreateAttemptHintEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/attempt_hint/create_attempt_hint_entries_complete.sql"
)


async def create_attempt_hint_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptHintEntriesApiResponse:
    """Internal function to create attempt_hint entry."""
    tags = ["entries", "attempt_hint"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptHintEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptHintEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_hint entry")

    await invalidate_tags(tags)

    return CreateAttemptHintEntriesApiResponse.model_validate(result.model_dump())

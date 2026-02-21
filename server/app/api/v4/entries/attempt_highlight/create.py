"""Attempt Highlight entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptHighlightEntriesApiResponse,
    CreateAttemptHighlightEntriesSqlParams,
    CreateAttemptHighlightEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_highlight/create_attempt_highlight_entries_complete.sql"


async def create_attempt_highlight_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptHighlightEntriesApiResponse:
    """Internal function to create attempt_highlight entry."""
    tags = ["entries", "attempt_highlight"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptHighlightEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptHighlightEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_highlight entry")

    await invalidate_tags(tags)

    return CreateAttemptHighlightEntriesApiResponse.model_validate(result.model_dump())

"""Attempt Content entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptContentEntriesApiResponse,
    CreateAttemptContentEntriesSqlParams,
    CreateAttemptContentEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_content/create_attempt_content_entries_complete.sql"


async def create_attempt_content_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptContentEntriesApiResponse:
    """Internal function to create attempt_content entry."""
    tags = ["entries", "attempt_content"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptContentEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptContentEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_content entry")

    await invalidate_tags(tags)

    return CreateAttemptContentEntriesApiResponse.model_validate(result.model_dump())

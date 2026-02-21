"""Test Completion entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestCompletionEntriesApiResponse,
    CreateTestCompletionEntriesSqlParams,
    CreateTestCompletionEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/test_completion/create_test_completion_entries_complete.sql"


async def create_test_completion_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestCompletionEntriesApiResponse:
    """Internal function to create test_completion entry."""
    tags = ["entries", "test_completion"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestCompletionEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestCompletionEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_completion entry")

    await invalidate_tags(tags)

    return CreateTestCompletionEntriesApiResponse.model_validate(result.model_dump())

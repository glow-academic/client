"""Tests entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestsEntriesApiResponse,
    CreateTestsEntriesSqlParams,
    CreateTestsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/tests/create_tests_entries_complete.sql"


async def create_tests_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestsEntriesApiResponse:
    """Internal function to create tests entry."""
    tags = ["entries", "tests"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestsEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create tests entry")

    await invalidate_tags(tags)

    return CreateTestsEntriesApiResponse.model_validate(result.model_dump())

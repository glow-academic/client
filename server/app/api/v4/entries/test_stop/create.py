"""Test Stop entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestStopEntriesApiResponse,
    CreateTestStopEntriesSqlParams,
    CreateTestStopEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/test_stop/create_test_stop_entries_complete.sql"


async def create_test_stop_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestStopEntriesApiResponse:
    """Internal function to create test_stop entry."""
    tags = ["entries", "test_stop"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestStopEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestStopEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_stop entry")

    await invalidate_tags(tags)

    return CreateTestStopEntriesApiResponse.model_validate(result.model_dump())

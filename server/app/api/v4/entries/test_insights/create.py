"""Test Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestInsightsEntriesApiResponse,
    CreateTestInsightsEntriesSqlParams,
    CreateTestInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/test_insights/create_test_insights_entries_complete.sql"
)


async def create_test_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestInsightsEntriesApiResponse:
    """Internal function to create test_insights entry."""
    tags = ["entries", "test_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_insights entry")

    await invalidate_tags(tags)

    return CreateTestInsightsEntriesApiResponse.model_validate(result.model_dump())

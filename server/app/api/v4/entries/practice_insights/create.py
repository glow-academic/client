"""Practice Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePracticeInsightsEntriesApiResponse,
    CreatePracticeInsightsEntriesSqlParams,
    CreatePracticeInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/practice_insights/create_practice_insights_entries_complete.sql"


async def create_practice_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePracticeInsightsEntriesApiResponse:
    """Internal function to create practice_insights entry."""
    tags = ["entries", "practice_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePracticeInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreatePracticeInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create practice_insights entry")

    await invalidate_tags(tags)

    return CreatePracticeInsightsEntriesApiResponse.model_validate(result.model_dump())

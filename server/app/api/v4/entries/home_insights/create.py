"""Home Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateHomeInsightsEntriesApiResponse,
    CreateHomeInsightsEntriesSqlParams,
    CreateHomeInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/home_insights/create_home_insights_entries_complete.sql"
)


async def create_home_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHomeInsightsEntriesApiResponse:
    """Internal function to create home_insights entry."""
    tags = ["entries", "home_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHomeInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateHomeInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create home_insights entry")

    await invalidate_tags(tags)

    return CreateHomeInsightsEntriesApiResponse.model_validate(result.model_dump())

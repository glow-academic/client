"""Activity Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateActivityInsightsEntriesApiResponse,
    CreateActivityInsightsEntriesSqlParams,
    CreateActivityInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/activity_insights/create_activity_insights_entries_complete.sql"


async def create_activity_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateActivityInsightsEntriesApiResponse:
    """Internal function to create activity_insights entry."""
    tags = ["entries", "activity_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateActivityInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateActivityInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create activity_insights entry")

    await invalidate_tags(tags)

    return CreateActivityInsightsEntriesApiResponse.model_validate(result.model_dump())

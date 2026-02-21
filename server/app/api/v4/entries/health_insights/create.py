"""Health Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateHealthInsightsEntriesApiResponse,
    CreateHealthInsightsEntriesSqlParams,
    CreateHealthInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/health_insights/create_health_insights_entries_complete.sql"


async def create_health_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHealthInsightsEntriesApiResponse:
    """Internal function to create health_insights entry."""
    tags = ["entries", "health_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHealthInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateHealthInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create health_insights entry")

    await invalidate_tags(tags)

    return CreateHealthInsightsEntriesApiResponse.model_validate(result.model_dump())

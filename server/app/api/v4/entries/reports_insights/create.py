"""Reports Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateReportsInsightsEntriesApiResponse,
    CreateReportsInsightsEntriesSqlParams,
    CreateReportsInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/reports_insights/create_reports_insights_entries_complete.sql"


async def create_reports_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateReportsInsightsEntriesApiResponse:
    """Internal function to create reports_insights entry."""
    tags = ["entries", "reports_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateReportsInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateReportsInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create reports_insights entry")

    await invalidate_tags(tags)

    return CreateReportsInsightsEntriesApiResponse.model_validate(result.model_dump())

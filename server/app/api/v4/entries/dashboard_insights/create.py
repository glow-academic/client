"""Dashboard Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateDashboardInsightsEntriesApiResponse,
    CreateDashboardInsightsEntriesSqlParams,
    CreateDashboardInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/dashboard_insights/create_dashboard_insights_entries_complete.sql"


async def create_dashboard_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateDashboardInsightsEntriesApiResponse:
    """Internal function to create dashboard_insights entry."""
    tags = ["entries", "dashboard_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateDashboardInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateDashboardInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create dashboard_insights entry")

    await invalidate_tags(tags)

    return CreateDashboardInsightsEntriesApiResponse.model_validate(result.model_dump())

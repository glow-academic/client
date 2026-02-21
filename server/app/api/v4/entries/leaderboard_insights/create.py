"""Leaderboard Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateLeaderboardInsightsEntriesApiResponse,
    CreateLeaderboardInsightsEntriesSqlParams,
    CreateLeaderboardInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/leaderboard_insights/create_leaderboard_insights_entries_complete.sql"


async def create_leaderboard_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateLeaderboardInsightsEntriesApiResponse:
    """Internal function to create leaderboard_insights entry."""
    tags = ["entries", "leaderboard_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateLeaderboardInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateLeaderboardInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create leaderboard_insights entry")

    await invalidate_tags(tags)

    return CreateLeaderboardInsightsEntriesApiResponse.model_validate(
        result.model_dump()
    )

"""Benchmark Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateBenchmarkInsightsEntriesApiResponse,
    CreateBenchmarkInsightsEntriesSqlParams,
    CreateBenchmarkInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/benchmark_insights/create_benchmark_insights_entries_complete.sql"


async def create_benchmark_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateBenchmarkInsightsEntriesApiResponse:
    """Internal function to create benchmark_insights entry."""
    tags = ["entries", "benchmark_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateBenchmarkInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateBenchmarkInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create benchmark_insights entry")

    await invalidate_tags(tags)

    return CreateBenchmarkInsightsEntriesApiResponse.model_validate(result.model_dump())

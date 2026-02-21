"""Benchmark entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateBenchmarkEntriesApiResponse,
    CreateBenchmarkEntriesSqlParams,
    CreateBenchmarkEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/benchmark/create_benchmark_entries_complete.sql"


async def create_benchmark_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateBenchmarkEntriesApiResponse:
    """Internal function to create benchmark entry."""
    tags = ["entries", "benchmark"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateBenchmarkEntriesSqlParams(**request_dict)

        result = cast(
            CreateBenchmarkEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create benchmark entry")

    await invalidate_tags(tags)

    return CreateBenchmarkEntriesApiResponse.model_validate(result.model_dump())

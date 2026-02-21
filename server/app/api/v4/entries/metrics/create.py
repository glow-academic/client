"""Metrics entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateMetricsEntriesApiResponse,
    CreateMetricsEntriesSqlParams,
    CreateMetricsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/metrics/create_metrics_entries_complete.sql"


async def create_metrics_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateMetricsEntriesApiResponse:
    """Internal function to create metrics entry."""
    tags = ["entries", "metrics"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateMetricsEntriesSqlParams(**request_dict)

        result = cast(
            CreateMetricsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create metrics entry")

    await invalidate_tags(tags)

    return CreateMetricsEntriesApiResponse.model_validate(result.model_dump())

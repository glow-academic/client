"""Reports entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateReportsEntriesApiResponse,
    CreateReportsEntriesSqlParams,
    CreateReportsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/reports/create_reports_entries_complete.sql"


async def create_reports_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateReportsEntriesApiResponse:
    """Internal function to create reports entry."""
    tags = ["entries", "reports"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateReportsEntriesSqlParams(**request_dict)

        result = cast(
            CreateReportsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create reports entry")

    await invalidate_tags(tags)

    return CreateReportsEntriesApiResponse.model_validate(result.model_dump())

"""Health entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateHealthEntriesApiResponse,
    CreateHealthEntriesSqlParams,
    CreateHealthEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/health/create_health_entries_complete.sql"


async def create_health_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHealthEntriesApiResponse:
    """Internal function to create health entry."""
    tags = ["entries", "health"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHealthEntriesSqlParams(**request_dict)

        result = cast(
            CreateHealthEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create health entry")

    await invalidate_tags(tags)

    return CreateHealthEntriesApiResponse.model_validate(result.model_dump())

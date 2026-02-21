"""Activity entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateActivityEntriesApiResponse,
    CreateActivityEntriesSqlParams,
    CreateActivityEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/activity/create_activity_entries_complete.sql"


async def create_activity_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateActivityEntriesApiResponse:
    """Internal function to create activity entry."""
    tags = ["entries", "activity"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateActivityEntriesSqlParams(**request_dict)

        result = cast(
            CreateActivityEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create activity entry")

    await invalidate_tags(tags)

    return CreateActivityEntriesApiResponse.model_validate(result.model_dump())

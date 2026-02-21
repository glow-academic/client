"""Home entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateHomeEntriesApiResponse,
    CreateHomeEntriesSqlParams,
    CreateHomeEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/home/create_home_entries_complete.sql"


async def create_home_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHomeEntriesApiResponse:
    """Internal function to create home entry."""
    tags = ["entries", "home"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHomeEntriesSqlParams(**request_dict)

        result = cast(
            CreateHomeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create home entry")

    await invalidate_tags(tags)

    return CreateHomeEntriesApiResponse.model_validate(result.model_dump())

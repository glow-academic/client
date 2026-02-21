"""Debug Info entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateDebugInfoEntriesApiResponse,
    CreateDebugInfoEntriesSqlParams,
    CreateDebugInfoEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/debug_info/create_debug_info_entries_complete.sql"
)


async def create_debug_info_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateDebugInfoEntriesApiResponse:
    """Internal function to create debug_info entry."""
    tags = ["entries", "debug_info"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateDebugInfoEntriesSqlParams(**request_dict)

        result = cast(
            CreateDebugInfoEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create debug_info entry")

    await invalidate_tags(tags)

    return CreateDebugInfoEntriesApiResponse.model_validate(result.model_dump())

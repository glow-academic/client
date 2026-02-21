"""Sessions entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSessionsEntriesApiResponse,
    CreateSessionsEntriesSqlParams,
    CreateSessionsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/sessions/create_sessions_entries_complete.sql"


async def create_sessions_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSessionsEntriesApiResponse:
    """Internal function to create sessions entry."""
    tags = ["entries", "sessions"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSessionsEntriesSqlParams(**request_dict)

        result = cast(
            CreateSessionsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create sessions entry")

    await invalidate_tags(tags)

    return CreateSessionsEntriesApiResponse.model_validate(result.model_dump())

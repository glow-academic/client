"""Calls entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateCallsEntriesApiResponse,
    CreateCallsEntriesSqlParams,
    CreateCallsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/calls/create_calls_entries_complete.sql"


async def create_calls_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateCallsEntriesApiResponse:
    """Internal function to create calls entry."""
    tags = ["entries", "calls"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateCallsEntriesSqlParams(**request_dict)

        result = cast(
            CreateCallsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create calls entry")

    await invalidate_tags(tags)

    return CreateCallsEntriesApiResponse.model_validate(result.model_dump())

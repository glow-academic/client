"""Mutes entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateMutesEntriesApiResponse,
    CreateMutesEntriesSqlParams,
    CreateMutesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/mutes/create_mutes_entries_complete.sql"


async def create_mutes_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateMutesEntriesApiResponse:
    """Internal function to create mutes entry."""
    tags = ["entries", "mutes"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateMutesEntriesSqlParams(**request_dict)

        result = cast(
            CreateMutesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create mutes entry")

    await invalidate_tags(tags)

    return CreateMutesEntriesApiResponse.model_validate(result.model_dump())

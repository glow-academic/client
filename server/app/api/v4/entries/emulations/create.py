"""Emulations entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateEmulationsEntriesApiResponse,
    CreateEmulationsEntriesSqlParams,
    CreateEmulationsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/emulations/create_emulations_entries_complete.sql"
)


async def create_emulations_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateEmulationsEntriesApiResponse:
    """Internal function to create emulations entry."""
    tags = ["entries", "emulations"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateEmulationsEntriesSqlParams(**request_dict)

        result = cast(
            CreateEmulationsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create emulations entry")

    await invalidate_tags(tags)

    return CreateEmulationsEntriesApiResponse.model_validate(result.model_dump())

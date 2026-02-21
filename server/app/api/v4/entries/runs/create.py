"""Runs entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateRunsEntriesApiResponse,
    CreateRunsEntriesSqlParams,
    CreateRunsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/runs/create_runs_entries_complete.sql"


async def create_runs_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateRunsEntriesApiResponse:
    """Internal function to create runs entry."""
    tags = ["entries", "runs"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateRunsEntriesSqlParams(**request_dict)

        result = cast(
            CreateRunsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create runs entry")

    await invalidate_tags(tags)

    return CreateRunsEntriesApiResponse.model_validate(result.model_dump())

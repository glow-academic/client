"""Bindings entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateBindingsEntriesApiResponse,
    CreateBindingsEntriesSqlParams,
    CreateBindingsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/bindings/create_bindings_entries_complete.sql"


async def create_bindings_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateBindingsEntriesApiResponse:
    """Internal function to create bindings entry."""
    tags = ["entries", "bindings"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateBindingsEntriesSqlParams(**request_dict)

        result = cast(
            CreateBindingsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create bindings entry")

    await invalidate_tags(tags)

    return CreateBindingsEntriesApiResponse.model_validate(result.model_dump())

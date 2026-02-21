"""Practice entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePracticeEntriesApiResponse,
    CreatePracticeEntriesSqlParams,
    CreatePracticeEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/practice/create_practice_entries_complete.sql"


async def create_practice_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePracticeEntriesApiResponse:
    """Internal function to create practice entry."""
    tags = ["entries", "practice"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePracticeEntriesSqlParams(**request_dict)

        result = cast(
            CreatePracticeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create practice entry")

    await invalidate_tags(tags)

    return CreatePracticeEntriesApiResponse.model_validate(result.model_dump())

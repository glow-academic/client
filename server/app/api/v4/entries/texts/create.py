"""Texts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTextsEntriesApiResponse,
    CreateTextsEntriesSqlParams,
    CreateTextsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/texts/create_texts_entries_complete.sql"


async def create_texts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTextsEntriesApiResponse:
    """Internal function to create texts entry."""
    tags = ["entries", "texts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTextsEntriesSqlParams(**request_dict)

        result = cast(
            CreateTextsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create texts entry")

    await invalidate_tags(tags)

    return CreateTextsEntriesApiResponse.model_validate(result.model_dump())

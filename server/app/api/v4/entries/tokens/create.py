"""Tokens entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTokensEntriesApiResponse,
    CreateTokensEntriesSqlParams,
    CreateTokensEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/tokens/create_tokens_entries_complete.sql"


async def create_tokens_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTokensEntriesApiResponse:
    """Internal function to create tokens entry."""
    tags = ["entries", "tokens"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTokensEntriesSqlParams(**request_dict)

        result = cast(
            CreateTokensEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create tokens entry")

    await invalidate_tags(tags)

    return CreateTokensEntriesApiResponse.model_validate(result.model_dump())

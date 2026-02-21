"""Attempt Strength entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptStrengthEntriesApiResponse,
    CreateAttemptStrengthEntriesSqlParams,
    CreateAttemptStrengthEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_strength/create_attempt_strength_entries_complete.sql"


async def create_attempt_strength_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptStrengthEntriesApiResponse:
    """Internal function to create attempt_strength entry."""
    tags = ["entries", "attempt_strength"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptStrengthEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptStrengthEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_strength entry")

    await invalidate_tags(tags)

    return CreateAttemptStrengthEntriesApiResponse.model_validate(result.model_dump())

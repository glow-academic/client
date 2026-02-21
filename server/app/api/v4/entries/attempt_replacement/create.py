"""Attempt Replacement entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptReplacementEntriesApiResponse,
    CreateAttemptReplacementEntriesSqlParams,
    CreateAttemptReplacementEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_replacement/create_attempt_replacement_entries_complete.sql"


async def create_attempt_replacement_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptReplacementEntriesApiResponse:
    """Internal function to create attempt_replacement entry."""
    tags = ["entries", "attempt_replacement"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptReplacementEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptReplacementEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_replacement entry")

    await invalidate_tags(tags)

    return CreateAttemptReplacementEntriesApiResponse.model_validate(
        result.model_dump()
    )

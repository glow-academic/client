"""Attempt Improvement entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptImprovementEntriesApiResponse,
    CreateAttemptImprovementEntriesSqlParams,
    CreateAttemptImprovementEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_improvement/create_attempt_improvement_entries_complete.sql"


async def create_attempt_improvement_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptImprovementEntriesApiResponse:
    """Internal function to create attempt_improvement entry."""
    tags = ["entries", "attempt_improvement"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptImprovementEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptImprovementEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_improvement entry")

    await invalidate_tags(tags)

    return CreateAttemptImprovementEntriesApiResponse.model_validate(
        result.model_dump()
    )

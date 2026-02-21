"""Attempt Grade entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptGradeEntriesApiResponse,
    CreateAttemptGradeEntriesSqlParams,
    CreateAttemptGradeEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/attempt_grade/create_attempt_grade_entries_complete.sql"
)


async def create_attempt_grade_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptGradeEntriesApiResponse:
    """Internal function to create attempt_grade entry."""
    tags = ["entries", "attempt_grade"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptGradeEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptGradeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_grade entry")

    await invalidate_tags(tags)

    return CreateAttemptGradeEntriesApiResponse.model_validate(result.model_dump())

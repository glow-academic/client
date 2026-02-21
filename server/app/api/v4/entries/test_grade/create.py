"""Test Grade entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestGradeEntriesApiResponse,
    CreateTestGradeEntriesSqlParams,
    CreateTestGradeEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/test_grade/create_test_grade_entries_complete.sql"
)


async def create_test_grade_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestGradeEntriesApiResponse:
    """Internal function to create test_grade entry."""
    tags = ["entries", "test_grade"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestGradeEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestGradeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_grade entry")

    await invalidate_tags(tags)

    return CreateTestGradeEntriesApiResponse.model_validate(result.model_dump())

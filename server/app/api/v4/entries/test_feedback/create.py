"""Test Feedback entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTestFeedbackEntriesApiResponse,
    CreateTestFeedbackEntriesSqlParams,
    CreateTestFeedbackEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/test_feedback/create_test_feedback_entries_complete.sql"
)


async def create_test_feedback_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTestFeedbackEntriesApiResponse:
    """Internal function to create test_feedback entry."""
    tags = ["entries", "test_feedback"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTestFeedbackEntriesSqlParams(**request_dict)

        result = cast(
            CreateTestFeedbackEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_feedback entry")

    await invalidate_tags(tags)

    return CreateTestFeedbackEntriesApiResponse.model_validate(result.model_dump())

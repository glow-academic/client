"""Attempt Feedback entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptFeedbackEntriesApiResponse,
    CreateAttemptFeedbackEntriesSqlParams,
    CreateAttemptFeedbackEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_feedback/create_attempt_feedback_entries_complete.sql"


async def create_attempt_feedback_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptFeedbackEntriesApiResponse:
    """Internal function to create attempt_feedback entry."""
    tags = ["entries", "attempt_feedback"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptFeedbackEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptFeedbackEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_feedback entry")

    await invalidate_tags(tags)

    return CreateAttemptFeedbackEntriesApiResponse.model_validate(result.model_dump())

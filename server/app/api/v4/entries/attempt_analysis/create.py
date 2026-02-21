"""Attempt Analysis entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptAnalysisEntriesApiResponse,
    CreateAttemptAnalysisEntriesSqlParams,
    CreateAttemptAnalysisEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_analysis/create_attempt_analysis_entries_complete.sql"


async def create_attempt_analysis_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptAnalysisEntriesApiResponse:
    """Internal function to create attempt_analysis entry."""
    tags = ["entries", "attempt_analysis"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptAnalysisEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptAnalysisEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_analysis entry")

    await invalidate_tags(tags)

    return CreateAttemptAnalysisEntriesApiResponse.model_validate(result.model_dump())

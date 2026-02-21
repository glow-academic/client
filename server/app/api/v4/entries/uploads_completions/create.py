"""Uploads Completions entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateUploadsCompletionsEntriesApiResponse,
    CreateUploadsCompletionsEntriesSqlParams,
    CreateUploadsCompletionsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/uploads_completions/create_uploads_completions_entries_complete.sql"


async def create_uploads_completions_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateUploadsCompletionsEntriesApiResponse:
    """Internal function to create uploads_completions entry."""
    tags = ["entries", "uploads_completions"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateUploadsCompletionsEntriesSqlParams(**request_dict)

        result = cast(
            CreateUploadsCompletionsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create uploads_completions entry")

    await invalidate_tags(tags)

    return CreateUploadsCompletionsEntriesApiResponse.model_validate(
        result.model_dump()
    )

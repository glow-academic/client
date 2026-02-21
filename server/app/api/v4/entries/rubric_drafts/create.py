"""Rubric Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateRubricDraftsEntriesApiResponse,
    CreateRubricDraftsEntriesSqlParams,
    CreateRubricDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/rubric_drafts/create_rubric_drafts_entries_complete.sql"
)


async def create_rubric_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateRubricDraftsEntriesApiResponse:
    """Internal function to create rubric_drafts entry."""
    tags = ["entries", "rubric_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateRubricDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateRubricDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create rubric_drafts entry")

    await invalidate_tags(tags)

    return CreateRubricDraftsEntriesApiResponse.model_validate(result.model_dump())

"""Eval Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateEvalDraftsEntriesApiResponse,
    CreateEvalDraftsEntriesSqlParams,
    CreateEvalDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/eval_drafts/create_eval_drafts_entries_complete.sql"
)


async def create_eval_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateEvalDraftsEntriesApiResponse:
    """Internal function to create eval_drafts entry."""
    tags = ["entries", "eval_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateEvalDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateEvalDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create eval_drafts entry")

    await invalidate_tags(tags)

    return CreateEvalDraftsEntriesApiResponse.model_validate(result.model_dump())

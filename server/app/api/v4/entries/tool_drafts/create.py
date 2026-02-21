"""Tool Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateToolDraftsEntriesApiResponse,
    CreateToolDraftsEntriesSqlParams,
    CreateToolDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/tool_drafts/create_tool_drafts_entries_complete.sql"
)


async def create_tool_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateToolDraftsEntriesApiResponse:
    """Internal function to create tool_drafts entry."""
    tags = ["entries", "tool_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateToolDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateToolDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create tool_drafts entry")

    await invalidate_tags(tags)

    return CreateToolDraftsEntriesApiResponse.model_validate(result.model_dump())

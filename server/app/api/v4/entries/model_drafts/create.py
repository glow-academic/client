"""Model Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateModelDraftsEntriesApiResponse,
    CreateModelDraftsEntriesSqlParams,
    CreateModelDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/model_drafts/create_model_drafts_entries_complete.sql"
)


async def create_model_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateModelDraftsEntriesApiResponse:
    """Internal function to create model_drafts entry."""
    tags = ["entries", "model_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateModelDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateModelDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create model_drafts entry")

    await invalidate_tags(tags)

    return CreateModelDraftsEntriesApiResponse.model_validate(result.model_dump())

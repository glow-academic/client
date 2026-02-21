"""Field Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateFieldDraftsEntriesApiResponse,
    CreateFieldDraftsEntriesSqlParams,
    CreateFieldDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/field_drafts/create_field_drafts_entries_complete.sql"
)


async def create_field_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateFieldDraftsEntriesApiResponse:
    """Internal function to create field_drafts entry."""
    tags = ["entries", "field_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateFieldDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateFieldDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create field_drafts entry")

    await invalidate_tags(tags)

    return CreateFieldDraftsEntriesApiResponse.model_validate(result.model_dump())

"""Suite Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSuiteDraftsEntriesApiResponse,
    CreateSuiteDraftsEntriesSqlParams,
    CreateSuiteDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/suite_drafts/create_suite_drafts_entries_complete.sql"
)


async def create_suite_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSuiteDraftsEntriesApiResponse:
    """Internal function to create suite_drafts entry."""
    tags = ["entries", "suite_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSuiteDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateSuiteDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create suite_drafts entry")

    await invalidate_tags(tags)

    return CreateSuiteDraftsEntriesApiResponse.model_validate(result.model_dump())

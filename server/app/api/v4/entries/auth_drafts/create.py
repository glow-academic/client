"""Auth Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAuthDraftsEntriesApiResponse,
    CreateAuthDraftsEntriesSqlParams,
    CreateAuthDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/auth_drafts/create_auth_drafts_entries_complete.sql"
)


async def create_auth_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAuthDraftsEntriesApiResponse:
    """Internal function to create auth_drafts entry."""
    tags = ["entries", "auth_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAuthDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateAuthDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create auth_drafts entry")

    await invalidate_tags(tags)

    return CreateAuthDraftsEntriesApiResponse.model_validate(result.model_dump())

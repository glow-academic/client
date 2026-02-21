"""Provider Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateProviderDraftsEntriesApiResponse,
    CreateProviderDraftsEntriesSqlParams,
    CreateProviderDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/provider_drafts/create_provider_drafts_entries_complete.sql"


async def create_provider_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateProviderDraftsEntriesApiResponse:
    """Internal function to create provider_drafts entry."""
    tags = ["entries", "provider_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateProviderDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateProviderDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create provider_drafts entry")

    await invalidate_tags(tags)

    return CreateProviderDraftsEntriesApiResponse.model_validate(result.model_dump())

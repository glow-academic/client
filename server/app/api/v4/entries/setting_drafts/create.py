"""Setting Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSettingDraftsEntriesApiResponse,
    CreateSettingDraftsEntriesSqlParams,
    CreateSettingDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/setting_drafts/create_setting_drafts_entries_complete.sql"


async def create_setting_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSettingDraftsEntriesApiResponse:
    """Internal function to create setting_drafts entry."""
    tags = ["entries", "setting_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSettingDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateSettingDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create setting_drafts entry")

    await invalidate_tags(tags)

    return CreateSettingDraftsEntriesApiResponse.model_validate(result.model_dump())

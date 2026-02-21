"""Groups entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateGroupsEntriesApiResponse,
    CreateGroupsEntriesSqlParams,
    CreateGroupsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/groups/create_groups_entries_complete.sql"


async def create_groups_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateGroupsEntriesApiResponse:
    """Internal function to create groups entry."""
    tags = ["entries", "groups"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateGroupsEntriesSqlParams(**request_dict)

        result = cast(
            CreateGroupsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create groups entry")

    await invalidate_tags(tags)

    return CreateGroupsEntriesApiResponse.model_validate(result.model_dump())

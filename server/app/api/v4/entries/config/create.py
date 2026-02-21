"""Config entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateConfigEntriesApiResponse,
    CreateConfigEntriesSqlParams,
    CreateConfigEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/config/create_config_entries_complete.sql"


async def create_config_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateConfigEntriesApiResponse:
    """Internal function to create config entry."""
    tags = ["entries", "config"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateConfigEntriesSqlParams(**request_dict)

        result = cast(
            CreateConfigEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create config entry")

    await invalidate_tags(tags)

    return CreateConfigEntriesApiResponse.model_validate(result.model_dump())

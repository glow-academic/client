"""Videos entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateVideosEntriesApiResponse,
    CreateVideosEntriesSqlParams,
    CreateVideosEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/videos/create_videos_entries_complete.sql"


async def create_videos_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateVideosEntriesApiResponse:
    """Internal function to create videos entry."""
    tags = ["entries", "videos"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateVideosEntriesSqlParams(**request_dict)

        result = cast(
            CreateVideosEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create videos entry")

    await invalidate_tags(tags)

    return CreateVideosEntriesApiResponse.model_validate(result.model_dump())

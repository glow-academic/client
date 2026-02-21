"""Audios entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAudiosEntriesApiResponse,
    CreateAudiosEntriesSqlParams,
    CreateAudiosEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/audios/create_audios_entries_complete.sql"


async def create_audios_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAudiosEntriesApiResponse:
    """Internal function to create audios entry."""
    tags = ["entries", "audios"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAudiosEntriesSqlParams(**request_dict)

        result = cast(
            CreateAudiosEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create audios entry")

    await invalidate_tags(tags)

    return CreateAudiosEntriesApiResponse.model_validate(result.model_dump())

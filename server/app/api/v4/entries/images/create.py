"""Images entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateImagesEntriesApiResponse,
    CreateImagesEntriesSqlParams,
    CreateImagesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/images/create_images_entries_complete.sql"


async def create_images_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateImagesEntriesApiResponse:
    """Internal function to create images entry."""
    tags = ["entries", "images"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateImagesEntriesSqlParams(**request_dict)

        result = cast(
            CreateImagesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create images entry")

    await invalidate_tags(tags)

    return CreateImagesEntriesApiResponse.model_validate(result.model_dump())

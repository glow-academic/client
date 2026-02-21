"""Home Training entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateHomeTrainingEntriesApiResponse,
    CreateHomeTrainingEntriesSqlParams,
    CreateHomeTrainingEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/home_training/create_home_training_entries_complete.sql"
)


async def create_home_training_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHomeTrainingEntriesApiResponse:
    """Internal function to create home_training entry."""
    tags = ["entries", "home_training"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHomeTrainingEntriesSqlParams(**request_dict)

        result = cast(
            CreateHomeTrainingEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create home_training entry")

    await invalidate_tags(tags)

    return CreateHomeTrainingEntriesApiResponse.model_validate(result.model_dump())

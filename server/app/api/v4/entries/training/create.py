"""Training entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTrainingEntriesApiResponse,
    CreateTrainingEntriesSqlParams,
    CreateTrainingEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/training/create_training_entries_complete.sql"


async def create_training_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTrainingEntriesApiResponse:
    """Internal function to create training entry."""
    tags = ["entries", "training"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTrainingEntriesSqlParams(**request_dict)

        result = cast(
            CreateTrainingEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create training entry")

    await invalidate_tags(tags)

    return CreateTrainingEntriesApiResponse.model_validate(result.model_dump())

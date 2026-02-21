"""Practice Training entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePracticeTrainingEntriesApiResponse,
    CreatePracticeTrainingEntriesSqlParams,
    CreatePracticeTrainingEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/practice_training/create_practice_training_entries_complete.sql"


async def create_practice_training_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePracticeTrainingEntriesApiResponse:
    """Internal function to create practice_training entry."""
    tags = ["entries", "practice_training"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePracticeTrainingEntriesSqlParams(**request_dict)

        result = cast(
            CreatePracticeTrainingEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create practice_training entry")

    await invalidate_tags(tags)

    return CreatePracticeTrainingEntriesApiResponse.model_validate(result.model_dump())

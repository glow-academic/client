"""Training Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateTrainingDraftsEntriesApiResponse,
    CreateTrainingDraftsEntriesSqlParams,
    CreateTrainingDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/training_drafts/create_training_drafts_entries_complete.sql"


async def create_training_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateTrainingDraftsEntriesApiResponse:
    """Internal function to create training_drafts entry."""
    tags = ["entries", "training_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateTrainingDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateTrainingDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create training_drafts entry")

    await invalidate_tags(tags)

    return CreateTrainingDraftsEntriesApiResponse.model_validate(result.model_dump())

"""Parameter Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateParameterDraftsEntriesApiResponse,
    CreateParameterDraftsEntriesSqlParams,
    CreateParameterDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/parameter_drafts/create_parameter_drafts_entries_complete.sql"


async def create_parameter_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateParameterDraftsEntriesApiResponse:
    """Internal function to create parameter_drafts entry."""
    tags = ["entries", "parameter_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateParameterDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateParameterDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create parameter_drafts entry")

    await invalidate_tags(tags)

    return CreateParameterDraftsEntriesApiResponse.model_validate(result.model_dump())

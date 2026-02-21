"""Persona Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePersonaDraftsEntriesApiResponse,
    CreatePersonaDraftsEntriesSqlParams,
    CreatePersonaDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/persona_drafts/create_persona_drafts_entries_complete.sql"


async def create_persona_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePersonaDraftsEntriesApiResponse:
    """Internal function to create persona_drafts entry."""
    tags = ["entries", "persona_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePersonaDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreatePersonaDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create persona_drafts entry")

    await invalidate_tags(tags)

    return CreatePersonaDraftsEntriesApiResponse.model_validate(result.model_dump())

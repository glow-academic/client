"""Persona entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePersonaEntriesApiResponse,
    CreatePersonaEntriesSqlParams,
    CreatePersonaEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/persona/create_persona_entries_complete.sql"


async def create_persona_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePersonaEntriesApiResponse:
    """Internal function to create persona entry."""
    tags = ["entries", "persona"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePersonaEntriesSqlParams(**request_dict)

        result = cast(
            CreatePersonaEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create persona entry")

    await invalidate_tags(tags)

    return CreatePersonaEntriesApiResponse.model_validate(result.model_dump())

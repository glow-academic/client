"""Audits entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAuditsEntriesApiResponse,
    CreateAuditsEntriesSqlParams,
    CreateAuditsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/audits/create_audits_entries_complete.sql"


async def create_audits_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAuditsEntriesApiResponse:
    """Internal function to create audits entry."""
    tags = ["entries", "audits"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAuditsEntriesSqlParams(**request_dict)

        result = cast(
            CreateAuditsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create audits entry")

    await invalidate_tags(tags)

    return CreateAuditsEntriesApiResponse.model_validate(result.model_dump())

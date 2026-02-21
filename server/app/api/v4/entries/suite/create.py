"""Suite entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSuiteEntriesApiResponse,
    CreateSuiteEntriesSqlParams,
    CreateSuiteEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/suite/create_suite_entries_complete.sql"


async def create_suite_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSuiteEntriesApiResponse:
    """Internal function to create suite entry."""
    tags = ["entries", "suite"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSuiteEntriesSqlParams(**request_dict)

        result = cast(
            CreateSuiteEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create suite entry")

    await invalidate_tags(tags)

    return CreateSuiteEntriesApiResponse.model_validate(result.model_dump())

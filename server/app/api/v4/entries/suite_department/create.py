"""Suite Department entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSuiteDepartmentEntriesApiResponse,
    CreateSuiteDepartmentEntriesSqlParams,
    CreateSuiteDepartmentEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/suite_department/create_suite_department_entries_complete.sql"


async def create_suite_department_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSuiteDepartmentEntriesApiResponse:
    """Internal function to create suite_department entry."""
    tags = ["entries", "suite_department"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSuiteDepartmentEntriesSqlParams(**request_dict)

        result = cast(
            CreateSuiteDepartmentEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create suite_department entry")

    await invalidate_tags(tags)

    return CreateSuiteDepartmentEntriesApiResponse.model_validate(result.model_dump())

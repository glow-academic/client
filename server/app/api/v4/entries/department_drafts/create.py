"""Department Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateDepartmentDraftsEntriesApiResponse,
    CreateDepartmentDraftsEntriesSqlParams,
    CreateDepartmentDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/department_drafts/create_department_drafts_entries_complete.sql"


async def create_department_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateDepartmentDraftsEntriesApiResponse:
    """Internal function to create department_drafts entry."""
    tags = ["entries", "department_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateDepartmentDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateDepartmentDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create department_drafts entry")

    await invalidate_tags(tags)

    return CreateDepartmentDraftsEntriesApiResponse.model_validate(result.model_dump())

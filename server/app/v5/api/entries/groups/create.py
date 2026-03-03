"""Internal groups entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.v5.api.entries.groups.types import (
    CreateGroupsEntryResponse,
    CreateGroupsEntrySqlParams,
    CreateGroupsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/groups/create_groups_entries_complete.sql"


async def create_groups_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID | None = None,
    name: str | None = None,
    custom_model: bool = False,
    mcp: bool = False,
) -> CreateGroupsEntryResponse:
    """Create a groups entry. Internal only — no HTTP route."""
    params = CreateGroupsEntrySqlParams(
        session_id=session_id, name=name, custom_model=custom_model, mcp=mcp
    )

    result = cast(
        CreateGroupsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create groups entry")

    return CreateGroupsEntryResponse.model_validate(result.model_dump())

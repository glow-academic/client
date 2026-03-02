"""Internal runs entry create — no HTTP route."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.runs.types import (
    CreateRunsEntryResponse,
    CreateRunsEntrySqlParams,
    CreateRunsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/runs/create_runs_entries_complete.sql"


async def create_runs_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    group_id: UUID | None = None,
    profiles_id: UUID | None = None,
    agent_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> CreateRunsEntryResponse:
    """Create a runs entry with optional connection params.

    Optionally links to profiles_resource via profiles_runs_connection
    and to agents_resource via runs_agents_connection.
    """
    params = CreateRunsEntrySqlParams(
        session_id=session_id,
        group_id=group_id,
        profiles_id=profiles_id,
        agent_ids=agent_ids,
        mcp=mcp,
    )

    result = cast(
        CreateRunsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create runs entry")

    return CreateRunsEntryResponse.model_validate(result.model_dump())

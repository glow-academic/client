"""Agent Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAgentDraftsEntriesApiResponse,
    CreateAgentDraftsEntriesSqlParams,
    CreateAgentDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/agent_drafts/create_agent_drafts_entries_complete.sql"
)


async def create_agent_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAgentDraftsEntriesApiResponse:
    """Internal function to create agent_drafts entry."""
    tags = ["entries", "agent_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAgentDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateAgentDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create agent_drafts entry")

    await invalidate_tags(tags)

    return CreateAgentDraftsEntriesApiResponse.model_validate(result.model_dump())

"""Scenario Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateScenarioDraftsEntriesApiResponse,
    CreateScenarioDraftsEntriesSqlParams,
    CreateScenarioDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/scenario_drafts/create_scenario_drafts_entries_complete.sql"


async def create_scenario_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateScenarioDraftsEntriesApiResponse:
    """Internal function to create scenario_drafts entry."""
    tags = ["entries", "scenario_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateScenarioDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateScenarioDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create scenario_drafts entry")

    await invalidate_tags(tags)

    return CreateScenarioDraftsEntriesApiResponse.model_validate(result.model_dump())

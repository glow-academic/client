"""Simulation Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateSimulationDraftsEntriesApiResponse,
    CreateSimulationDraftsEntriesSqlParams,
    CreateSimulationDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/simulation_drafts/create_simulation_drafts_entries_complete.sql"


async def create_simulation_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateSimulationDraftsEntriesApiResponse:
    """Internal function to create simulation_drafts entry."""
    tags = ["entries", "simulation_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateSimulationDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateSimulationDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create simulation_drafts entry")

    await invalidate_tags(tags)

    return CreateSimulationDraftsEntriesApiResponse.model_validate(result.model_dump())

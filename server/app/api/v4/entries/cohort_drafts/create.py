"""Cohort Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateCohortDraftsEntriesApiResponse,
    CreateCohortDraftsEntriesSqlParams,
    CreateCohortDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/cohort_drafts/create_cohort_drafts_entries_complete.sql"
)


async def create_cohort_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateCohortDraftsEntriesApiResponse:
    """Internal function to create cohort_drafts entry."""
    tags = ["entries", "cohort_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateCohortDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateCohortDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create cohort_drafts entry")

    await invalidate_tags(tags)

    return CreateCohortDraftsEntriesApiResponse.model_validate(result.model_dump())

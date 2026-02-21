"""Record Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateRecordInsightsEntriesApiResponse,
    CreateRecordInsightsEntriesSqlParams,
    CreateRecordInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/record_insights/create_record_insights_entries_complete.sql"


async def create_record_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateRecordInsightsEntriesApiResponse:
    """Internal function to create record_insights entry."""
    tags = ["entries", "record_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateRecordInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreateRecordInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create record_insights entry")

    await invalidate_tags(tags)

    return CreateRecordInsightsEntriesApiResponse.model_validate(result.model_dump())

"""Pricing Insights entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreatePricingInsightsEntriesApiResponse,
    CreatePricingInsightsEntriesSqlParams,
    CreatePricingInsightsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/pricing_insights/create_pricing_insights_entries_complete.sql"


async def create_pricing_insights_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreatePricingInsightsEntriesApiResponse:
    """Internal function to create pricing_insights entry."""
    tags = ["entries", "pricing_insights"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreatePricingInsightsEntriesSqlParams(**request_dict)

        result = cast(
            CreatePricingInsightsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create pricing_insights entry")

    await invalidate_tags(tags)

    return CreatePricingInsightsEntriesApiResponse.model_validate(result.model_dump())

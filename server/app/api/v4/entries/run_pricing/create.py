"""Run Pricing entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateRunPricingEntriesApiResponse,
    CreateRunPricingEntriesSqlParams,
    CreateRunPricingEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/run_pricing/create_run_pricing_entries_complete.sql"
)


async def create_run_pricing_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateRunPricingEntriesApiResponse:
    """Internal function to create run_pricing entry."""
    tags = ["entries", "run_pricing"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateRunPricingEntriesSqlParams(**request_dict)

        result = cast(
            CreateRunPricingEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create run_pricing entry")

    await invalidate_tags(tags)

    return CreateRunPricingEntriesApiResponse.model_validate(result.model_dump())

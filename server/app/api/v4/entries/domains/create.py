"""Domains entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateDomainsEntriesApiResponse,
    CreateDomainsEntriesSqlParams,
    CreateDomainsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/domains/create_domains_entries_complete.sql"


async def create_domains_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateDomainsEntriesApiResponse:
    """Internal function to create domains entry."""
    tags = ["entries", "domains"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateDomainsEntriesSqlParams(**request_dict)

        result = cast(
            CreateDomainsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create domains entry")

    await invalidate_tags(tags)

    return CreateDomainsEntriesApiResponse.model_validate(result.model_dump())

"""attempt_responses/create internal — reusable data-access layer."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateResponsesEntriesApiResponse,
    CreateResponsesEntriesSqlParams,
    CreateResponsesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/responses/create_responses_entries_complete.sql"


async def create_responses_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateResponsesEntriesApiResponse:
    """Internal function to create responses entry."""
    tags = ["entries", "attempt_responses"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateResponsesEntriesSqlParams(**request_dict)

        result = cast(
            CreateResponsesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create responses entry")

    await invalidate_tags(tags, redis=get_redis_client())

    return CreateResponsesEntriesApiResponse.model_validate(result.model_dump())

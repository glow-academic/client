"""Args Outputs Values entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateArgsOutputsValuesEntriesApiResponse,
    CreateArgsOutputsValuesEntriesSqlParams,
    CreateArgsOutputsValuesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/args_outputs_values/create_args_outputs_values_entries_complete.sql"


async def create_args_outputs_values_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateArgsOutputsValuesEntriesApiResponse:
    """Internal function to create args_outputs_values entry."""
    tags = ["entries", "args_outputs_values"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateArgsOutputsValuesEntriesSqlParams(**request_dict)

        result = cast(
            CreateArgsOutputsValuesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create args_outputs_values entry")

    await invalidate_tags(tags)

    return CreateArgsOutputsValuesEntriesApiResponse.model_validate(result.model_dump())

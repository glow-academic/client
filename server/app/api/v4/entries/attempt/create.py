"""Attempt entry CREATE endpoint."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    CreateAttemptEntriesApiResponse,
    CreateAttemptEntriesSqlParams,
    CreateAttemptEntriesSqlRow,
    CreateAttemptSqlParams,
    CreateAttemptSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

if TYPE_CHECKING:
    from app.api.v4.resources.training.context import TrainingAttemptContext

SQL_PATH = "app/sql/v4/queries/entries/attempt/create_attempt_entries_complete.sql"
SQL_PATH_CREATE_ATTEMPT = (
    "app/sql/v4/queries/artifacts/attempt/create_attempt_complete.sql"
)


async def create_attempt_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptEntriesApiResponse:
    """Internal function to create attempt entry (REST API path)."""
    tags = ["entries", "attempt"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptEntriesSqlParams(**request_dict)

        result = cast(
            CreateAttemptEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt entry")

    await invalidate_tags(tags)

    return CreateAttemptEntriesApiResponse.model_validate(result.model_dump())


async def create_attempt_with_context_internal(
    conn: asyncpg.Connection,
    context: TrainingAttemptContext,
    infinite_mode: bool = False,
) -> UUID:
    """Create attempt entry using pre-resolved training context.

    Used by socket handlers (home/practice/attempt).
    Returns the new attempt_id.
    """
    row = cast(
        CreateAttemptSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_CREATE_ATTEMPT,
            params=CreateAttemptSqlParams(
                p_practice=context.is_practice,
                p_infinite_mode=infinite_mode,
                p_practice_id=context.practice_id,
                p_home_id=context.home_id,
                p_simulations_resource_id=context.simulations_resource_id,
                p_profiles_resource_id=context.profiles_resource_id,
                p_cohorts_resource_id=context.cohorts_resource_id,
                p_departments_resource_id=context.departments_resource_id,
                p_roles_resource_id=context.roles_resource_id,
            ),
        ),
    )

    if not row or not row.out_attempt_id:
        raise ValueError("Failed to create attempt entry")

    await invalidate_tags(["attempt", "attempts"])

    return row.out_attempt_id

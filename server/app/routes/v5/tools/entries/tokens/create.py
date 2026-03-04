"""tokens/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.tokens.types import (
    CreateTokensEntryResponse,
    CreateTokensEntrySqlParams,
    CreateTokensEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/tokens/create_tokens_entries_complete.sql"


async def create_tokens_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    run_id: UUID,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cached_input_tokens: int = 0,
    mcp: bool = False,
) -> CreateTokensEntryResponse:
    """Create a tokens entry. Internal only — no HTTP route."""
    params = CreateTokensEntrySqlParams(
        session_id=session_id,
        run_id=run_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        mcp=mcp,
    )

    result = cast(
        CreateTokensEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create tokens entry")

    return CreateTokensEntryResponse.model_validate(result.model_dump())

"""run_pricing/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.run_pricing.types import (
    CreateRunPricingEntryResponse,
    CreateRunPricingEntrySqlParams,
    CreateRunPricingEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/run_pricing/create_run_pricing_entries_complete.sql"


async def create_run_pricing_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    pricing_type: str,
    run_id: UUID,
    count: int = 0,
    mcp: bool = False,
) -> CreateRunPricingEntryResponse:
    """Create a run_pricing entry. Internal only — no HTTP route."""
    params = CreateRunPricingEntrySqlParams(
        session_id=session_id,
        pricing_type=pricing_type,
        count=count,
        run_id=run_id,
        mcp=mcp,
    )

    result = cast(
        CreateRunPricingEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.id:
        raise ValueError("Failed to create run_pricing entry")

    return CreateRunPricingEntryResponse.model_validate(result.model_dump())

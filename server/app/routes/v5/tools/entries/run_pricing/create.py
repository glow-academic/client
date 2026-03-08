"""run_pricing/create internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.run_pricing.types import CreateRunPricingEntryResponse


async def create_run_pricing_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    pricing_type: str,
    run_id: UUID,
    count: int = 0,
    mcp: bool = False,
    soft: bool = False,
) -> CreateRunPricingEntryResponse:
    """Create a run_pricing entry."""
    pricing_id = await conn.fetchval(
        """
        INSERT INTO run_pricing_entry (session_id, pricing_type, count, run_id, mcp, generated)
        VALUES ($1, $2::pricing_type, $3, $4, $5, true)
        RETURNING id
        """,
        session_id,
        pricing_type,
        count,
        run_id,
        mcp,
    )

    if pricing_id is None:
        raise ValueError("Failed to create run_pricing entry")

    return CreateRunPricingEntryResponse(id=pricing_id)

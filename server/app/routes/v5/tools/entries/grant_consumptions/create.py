"""Grant consumptions CREATE — insert into grant_consumptions_entry."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.grant_consumptions.types import (
    CreateGrantConsumptionResponse,
)


async def create_grant_consumption(
    conn: asyncpg.Connection,
    grant_id: UUID,
    mcp: bool = False,
    soft: bool = False,
) -> CreateGrantConsumptionResponse:
    """Create a grant consumption entry."""
    consumption_id = await conn.fetchval(
        """
        INSERT INTO grant_consumptions_entry (grant_id, active, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
        """,
        grant_id,
        not soft,
        mcp,
    )

    if consumption_id is None:
        raise ValueError("Failed to create grant consumption entry")

    return CreateGrantConsumptionResponse(id=consumption_id)

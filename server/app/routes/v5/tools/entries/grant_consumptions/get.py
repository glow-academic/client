"""Grant consumptions GET — batch get from grant_consumptions_entry."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.grant_consumptions.types import (
    GetGrantConsumptionResponse,
)


async def get_grant_consumptions(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetGrantConsumptionResponse]:
    """Get grant consumption entries by IDs from grant_consumptions_entry."""
    if not ids:
        return []

    rows = await conn.fetch(
        """
        SELECT id, grant_id, created_at, active, mcp, generated
        FROM grant_consumptions_entry
        WHERE id = ANY($1)
        """,
        ids,
    )

    return [
        GetGrantConsumptionResponse(
            id=r["id"],
            grant_id=r["grant_id"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

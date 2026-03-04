"""simulation_drafts GET — thin wrapper around shared drafts CRUD."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.drafts.crud import get_drafts
from app.infra.drafts.types import GetDraftResponse

TABLE = "simulation_drafts_entry"


async def get_simulation_drafts(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetDraftResponse]:
    """Get simulation_drafts entries by IDs."""
    return await get_drafts(conn, TABLE, ids)

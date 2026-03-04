"""Entries CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.entries.get import get_entries
from app.routes.v5.tools.resources.entries.types import GetEntryResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_entry(
    conn: asyncpg.Connection,
    entry: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetEntryResponse:
    """Create an entry resource (insert or get existing)."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO entries_resource (entry, active, mcp, generated)
        VALUES ($1::entry_type, true, $2, $2)
        ON CONFLICT (entry) DO UPDATE SET entry = EXCLUDED.entry
        RETURNING id
    """,
        entry,
        mcp,
    )

    await invalidate_tags(["resources", "entries"], redis=redis)
    items = await get_entries(conn, [entry_id], redis, bypass_cache=True)
    return items[0]

"""Items CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.items.get import get_items
from app.routes.v5.tools.resources.items.types import GetItemResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_item(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    redis: Redis,
    mcp: bool = False,
    encrypted: bool = False,
    position: int = 0,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetItemResponse:
    """Create an item resource (plain INSERT — no unique constraint)."""
    item_id = await conn.fetchval(
        """
        INSERT INTO items_resource (name, description, encrypted, position, active, mcp, generated)
        VALUES ($1, $2, $3, $4, true, $5, $5)
        RETURNING id
        """,
        name,
        description,
        encrypted,
        position,
        mcp,
    )

    await invalidate_tags(["resources", "items"], redis=redis)
    items = await get_items(conn, [item_id], redis, bypass_cache=True)
    return items[0]

"""Keys CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.keys.get import get_keys
from app.routes.v5.tools.resources.keys.types import GetKeyResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_key(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    mcp: bool = False,
    key: str = "",
    description: str = "",
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetKeyResponse:
    """Create a key resource (plain INSERT — no unique constraint)."""
    key_id = await conn.fetchval(
        """
        INSERT INTO keys_resource (key, name, description, active, mcp, generated)
        VALUES ($1, $2, $3, true, $4, $4)
        RETURNING id
        """,
        key,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "keys"], redis=redis)
    items = await get_keys(conn, [key_id], redis, bypass_cache=True)
    return items[0]

"""Names CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.types import GetNameResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_name(
    conn: asyncpg.Connection,
    name: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetNameResponse:
    """Create a name resource (insert or get existing)."""
    name_id = await conn.fetchval(
        """
        INSERT INTO names_resource (name, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
    """,
        name,
        mcp,
    )

    await invalidate_tags(["resources", "names"], redis=redis)
    items = await get_names(conn, [name_id], redis, bypass_cache=True)
    return items[0]

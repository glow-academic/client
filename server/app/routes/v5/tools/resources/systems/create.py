"""Systems CREATE — reusable data-access layer."""
from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.systems.types import GetSystemResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_system(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetSystemResponse:
    """Create a system resource (plain INSERT — no unique constraint)."""
    system_id = await conn.fetchval(
        """
        INSERT INTO systems_resource (id, name, description, active, mcp, generated)
        VALUES (uuidv7(), $1, $2, true, $3, $3)
        RETURNING id
        """,
        name, description, mcp,
    )
    await invalidate_tags(["resources", "systems"], redis=redis)
    items = await get_systems(conn, [system_id], redis, bypass_cache=True)
    return items[0]

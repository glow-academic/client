"""Flags CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.types import GetFlagResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_flag(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    icon: str,
    redis: Redis,
    flag_type: str = "active",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetFlagResponse:
    """Create a flag resource."""
    flag_id = await conn.fetchval(
        """
        INSERT INTO flags_resource (name, description, icon, type, active, mcp, generated)
        VALUES ($1, $2, $3, $4::flag_type, true, $5, $5)
        RETURNING id
    """,
        name,
        description,
        icon,
        flag_type,
        mcp,
    )

    await invalidate_tags(["resources", "flags"], redis=redis)
    items = await get_flags(conn, [flag_id], redis, bypass_cache=True)
    return items[0]

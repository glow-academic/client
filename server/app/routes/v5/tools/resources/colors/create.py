"""Colors CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.colors.get import get_colors
from app.routes.v5.tools.resources.colors.types import GetColorResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_color(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    hex_code: str,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetColorResponse:
    """Create a color resource."""
    color_id = await conn.fetchval(
        """
        INSERT INTO colors_resource (name, description, hex_code, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
    """,
        name,
        description,
        hex_code,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "colors"], redis=redis)
    items = await get_colors(conn, [color_id], redis, bypass_cache=True)
    return items[0]

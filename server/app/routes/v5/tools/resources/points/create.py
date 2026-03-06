"""Points CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.points.get import get_points
from app.routes.v5.tools.resources.points.types import GetPointResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_point(
    conn: asyncpg.Connection,
    value: int,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetPointResponse:
    """Create a point resource (plain INSERT — no unique constraint)."""
    point_id = await conn.fetchval(
        """
        INSERT INTO points_resource (value, active, mcp, generated)
        VALUES ($1, $2, $3, $3)
        RETURNING id
        """,
        value,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "points"], redis=redis)
    items = await get_points(conn, [point_id], redis, bypass_cache=True)
    return items[0]

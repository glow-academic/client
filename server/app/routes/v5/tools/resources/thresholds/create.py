"""Thresholds CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.thresholds.get import get_thresholds
from app.routes.v5.tools.resources.thresholds.types import GetThresholdResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_threshold(
    conn: asyncpg.Connection,
    value: int,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetThresholdResponse:
    """Create a threshold resource (plain INSERT — no unique constraint)."""
    threshold_id = await conn.fetchval(
        """
        INSERT INTO thresholds_resource (value, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
        """,
        value,
        mcp,
    )

    await invalidate_tags(["resources", "thresholds"], redis=redis)
    items = await get_thresholds(conn, [threshold_id], redis, bypass_cache=True)
    return items[0]

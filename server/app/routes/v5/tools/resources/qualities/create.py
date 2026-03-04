"""Qualities CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.qualities.get import get_qualities
from app.routes.v5.tools.resources.qualities.types import GetQualityResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_quality(
    conn: asyncpg.Connection,
    quality: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetQualityResponse:
    """Create a quality resource (plain INSERT — no unique constraint)."""
    quality_id = await conn.fetchval(
        """
        INSERT INTO qualities_resource (quality, active, mcp, generated)
        VALUES ($1::quality_type, true, $2, $2)
        RETURNING id
        """,
        quality,
        mcp,
    )

    await invalidate_tags(["resources", "qualities"], redis=redis)
    items = await get_qualities(conn, [quality_id], redis, bypass_cache=True)
    return items[0]

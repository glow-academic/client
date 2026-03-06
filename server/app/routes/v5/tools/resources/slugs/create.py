"""Slugs CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.slugs.get import get_slugs
from app.routes.v5.tools.resources.slugs.types import GetSlugResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_slug(
    conn: asyncpg.Connection,
    value: str,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetSlugResponse:
    """Create a slug resource (insert or get existing)."""
    slug_id = await conn.fetchval(
        """
        INSERT INTO slugs_resource (value, active, mcp, generated)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (value) DO UPDATE SET value = EXCLUDED.value
        RETURNING id
    """,
        value,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "slugs"], redis=redis)
    items = await get_slugs(conn, [slug_id], redis, bypass_cache=True)
    return items[0]

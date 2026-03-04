"""Videos CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.videos.get import get_videos
from app.routes.v5.tools.resources.videos.types import GetVideoResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_video(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetVideoResponse:
    """Create a video resource."""
    video_id = await conn.fetchval(
        """
        INSERT INTO videos_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "videos"], redis=redis)
    items = await get_videos(conn, [video_id], redis, bypass_cache=True)
    return items[0]

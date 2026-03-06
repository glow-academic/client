"""Images CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.images.get import get_images
from app.routes.v5.tools.resources.images.types import GetImageResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_image(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetImageResponse:
    """Create an image resource."""
    image_id = await conn.fetchval(
        """
        INSERT INTO images_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
    """,
        name,
        description,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "images"], redis=redis)
    items = await get_images(conn, [image_id], redis, bypass_cache=True)
    return items[0]

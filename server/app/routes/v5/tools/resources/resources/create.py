"""Resources CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.resources.get import get_resources
from app.routes.v5.tools.resources.resources.types import GetResourceResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_resource(
    conn: asyncpg.Connection,
    resource: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetResourceResponse:
    """Create a resource resource (insert or get existing)."""
    resource_id = await conn.fetchval(
        """
        INSERT INTO resources_resource (resource, active, mcp, generated)
        VALUES ($1::resource_type, true, $2, $2)
        ON CONFLICT (resource) DO UPDATE SET resource = EXCLUDED.resource
        RETURNING id
    """,
        resource,
        mcp,
    )

    await invalidate_tags(["resources", "resources"], redis=redis)
    items = await get_resources(conn, [resource_id], redis, bypass_cache=True)
    return items[0]

"""Endpoints CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.endpoints.get import get_endpoints
from app.routes.v5.tools.resources.endpoints.types import GetEndpointResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_endpoint(
    conn: asyncpg.Connection,
    base_url: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetEndpointResponse:
    """Create an endpoint resource."""
    endpoint_id = await conn.fetchval(
        """
        INSERT INTO endpoints_resource (base_url, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        ON CONFLICT (base_url) WHERE active = true DO UPDATE SET base_url = EXCLUDED.base_url
        RETURNING id
    """,
        base_url,
        mcp,
    )

    await invalidate_tags(["resources", "endpoints"], redis=redis)
    items = await get_endpoints(conn, [endpoint_id], redis, bypass_cache=True)
    return items[0]

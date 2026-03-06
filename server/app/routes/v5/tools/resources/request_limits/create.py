"""Request Limits CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.request_limits.get import get_request_limits
from app.routes.v5.tools.resources.request_limits.types import GetRequestLimitResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_request_limit(
    conn: asyncpg.Connection,
    requests_per_day: int,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetRequestLimitResponse:
    """Create a request_limit resource (plain INSERT — no unique constraint)."""
    request_limit_id = await conn.fetchval(
        """
        INSERT INTO request_limits_resource (requests_per_day, active, mcp, generated)
        VALUES ($1, $2, $3, $3)
        RETURNING id
        """,
        requests_per_day,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "request_limits"], redis=redis)
    items = await get_request_limits(conn, [request_limit_id], redis, bypass_cache=True)
    return items[0]

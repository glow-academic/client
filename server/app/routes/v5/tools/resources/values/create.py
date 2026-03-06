"""Values CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.values.get import get_values
from app.routes.v5.tools.resources.values.types import GetValueResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_value(
    conn: asyncpg.Connection,
    value: str,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetValueResponse:
    """Create a value resource."""
    value_id = await conn.fetchval(
        """
        INSERT INTO values_resource (value, active, mcp, generated)
        VALUES ($1, $2, $3, $3)
        RETURNING id
    """,
        value,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "values"], redis=redis)
    items = await get_values(conn, [value_id], redis, bypass_cache=True)
    return items[0]

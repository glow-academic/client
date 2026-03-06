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
    value_type: str = "model",
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetValueResponse:
    """Create a value resource."""
    value_id = await conn.fetchval(
        """
        INSERT INTO values_resource (value, type, active, mcp, generated)
        VALUES ($1, $2::value_type, $3, $4, $4)
        RETURNING id
    """,
        value,
        value_type,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "values"], redis=redis)
    items = await get_values(conn, [value_id], redis, bypass_cache=True)
    return items[0]

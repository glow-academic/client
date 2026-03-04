"""Standards CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.standards.get import get_standards
from app.routes.v5.tools.resources.standards.types import GetStandardResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_standard(
    conn: asyncpg.Connection,
    name: str,
    description: str,
    points: int,
    standard_group_id: UUID,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetStandardResponse:
    """Create a standard resource (plain INSERT — no unique constraint)."""
    row_id = await conn.fetchval(
        """
        INSERT INTO standards_resource
            (name, description, points, standard_group_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, true, $5, $5)
        RETURNING id
        """,
        name,
        description,
        points,
        standard_group_id,
        mcp,
    )

    await invalidate_tags(["resources", "standards"], redis=redis)
    items = await get_standards(conn, [row_id], redis, bypass_cache=True)
    return items[0]

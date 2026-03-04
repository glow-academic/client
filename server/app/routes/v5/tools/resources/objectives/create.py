"""Objectives CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.objectives.get import get_objectives
from app.routes.v5.tools.resources.objectives.types import GetObjectiveResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_objective(
    conn: asyncpg.Connection,
    objective: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetObjectiveResponse:
    """Create an objective resource."""
    objective_id = await conn.fetchval(
        """
        INSERT INTO objectives_resource (objective, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
    """,
        objective,
        mcp,
    )

    await invalidate_tags(["resources", "objectives"], redis=redis)
    items = await get_objectives(conn, [objective_id], redis, bypass_cache=True)
    return items[0]

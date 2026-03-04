"""Cohorts CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.cohorts.get import get_cohorts
from app.routes.v5.tools.resources.cohorts.types import GetCohortResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_cohort(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetCohortResponse:
    """Create a cohort resource (plain INSERT — no unique constraint)."""
    cohort_id = await conn.fetchval(
        """
        INSERT INTO cohorts_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "cohorts"], redis=redis)
    items = await get_cohorts(conn, [cohort_id], redis, bypass_cache=True)
    return items[0]

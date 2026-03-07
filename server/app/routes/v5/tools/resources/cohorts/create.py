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
    id: UUID | None = None,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetCohortResponse:
    """Create a cohort resource (plain INSERT — no unique constraint)."""
    cohort_id = await conn.fetchval(
        """
        INSERT INTO cohorts_resource (id, name, description, active, mcp, generated)
        VALUES (COALESCE($5, uuidv7()), $1, $2, $3, $4, $4)
        RETURNING id
    """,
        name,
        description,
        not soft,
        mcp,
        id,
    )

    await invalidate_tags(["resources", "cohorts"], redis=redis)
    items = await get_cohorts(conn, [cohort_id], redis, bypass_cache=True)
    return items[0]

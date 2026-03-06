"""Rubrics CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.rubrics.get import get_rubrics
from app.routes.v5.tools.resources.rubrics.types import GetRubricResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_rubric(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetRubricResponse:
    """Create a rubric resource (plain INSERT — no unique constraint)."""
    rubric_id = await conn.fetchval(
        """
        INSERT INTO rubrics_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
    """,
        name,
        description,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "rubrics"], redis=redis)
    items = await get_rubrics(conn, [rubric_id], redis, bypass_cache=True)
    return items[0]

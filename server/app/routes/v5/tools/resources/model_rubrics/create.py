"""Model Rubrics CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.model_rubrics.get import get_model_rubrics
from app.routes.v5.tools.resources.model_rubrics.types import GetModelRubricResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_model_rubric(
    conn: asyncpg.Connection,
    model_id: UUID,
    rubric_id: UUID,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetModelRubricResponse:
    """Create a model_rubric resource (plain INSERT — no unique constraint)."""
    model_rubric_id = await conn.fetchval(
        """
        INSERT INTO model_rubrics_resource (model_id, rubric_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        model_id,
        rubric_id,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "model_rubrics"], redis=redis)
    items = await get_model_rubrics(conn, [model_rubric_id], redis, bypass_cache=True)
    return items[0]

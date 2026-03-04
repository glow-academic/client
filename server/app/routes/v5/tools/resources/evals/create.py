"""Evals CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.evals.get import get_evals
from app.routes.v5.tools.resources.evals.types import GetEvalResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_eval(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetEvalResponse:
    """Create an eval resource (plain INSERT — no unique constraint)."""
    eval_id = await conn.fetchval(
        """
        INSERT INTO evals_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "evals"], redis=redis)
    items = await get_evals(conn, [eval_id], redis, bypass_cache=True)
    return items[0]

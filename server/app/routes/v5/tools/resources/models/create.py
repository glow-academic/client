"""Models CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.models.types import GetModelResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_model(
    conn: asyncpg.Connection,
    value: str,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetModelResponse:
    """Create a model resource (plain INSERT — no unique constraint)."""
    model_id = await conn.fetchval(
        """
        INSERT INTO models_resource (value, name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
        """,
        value,
        name,
        description,
        not soft,
        mcp,
    )
    await invalidate_tags(["resources", "models"], redis=redis)
    items = await get_models(conn, [model_id], redis, bypass_cache=True)
    return items[0]

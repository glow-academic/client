"""Model Positions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.model_positions.get import get_model_positions
from app.routes.v5.tools.resources.model_positions.types import GetModelPositionResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_model_position(
    conn: asyncpg.Connection,
    model_id: UUID,
    value: int,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetModelPositionResponse:
    """Create a model_position resource (plain INSERT — no unique constraint)."""
    model_position_id = await conn.fetchval(
        """
        INSERT INTO model_positions_resource (model_id, value, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        model_id,
        value,
        mcp,
    )

    await invalidate_tags(["resources", "model_positions"], redis=redis)
    items = await get_model_positions(conn, [model_position_id], redis, bypass_cache=True)
    return items[0]

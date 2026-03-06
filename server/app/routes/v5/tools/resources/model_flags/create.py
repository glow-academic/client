"""Model Flags CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.model_flags.get import get_model_flags
from app.routes.v5.tools.resources.model_flags.types import GetModelFlagResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_model_flag(
    conn: asyncpg.Connection,
    model_id: UUID,
    flag_id: UUID,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetModelFlagResponse:
    """Create a model_flag resource (plain INSERT — no unique constraint)."""
    model_flag_id = await conn.fetchval(
        """
        INSERT INTO model_flags_resource (model_id, flag_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        model_id,
        flag_id,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "model_flags"], redis=redis)
    items = await get_model_flags(conn, [model_flag_id], redis, bypass_cache=True)
    return items[0]

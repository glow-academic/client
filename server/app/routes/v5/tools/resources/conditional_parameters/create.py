"""Conditional Parameters CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.conditional_parameters.get import (
    get_conditional_parameters,
)
from app.routes.v5.tools.resources.conditional_parameters.types import (
    GetConditionalParameterResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_conditional_parameter(
    conn: asyncpg.Connection,
    parameter_id: UUID,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetConditionalParameterResponse:
    """Create a conditional_parameter resource (ON CONFLICT on parameter_id upserts)."""
    conditional_parameter_id = await conn.fetchval(
        """
        INSERT INTO conditional_parameters_resource (parameter_id, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        ON CONFLICT (parameter_id) DO UPDATE SET parameter_id = EXCLUDED.parameter_id
        RETURNING id
        """,
        parameter_id,
        mcp,
    )

    await invalidate_tags(["resources", "conditional_parameters"], redis=redis)
    items = await get_conditional_parameters(
        conn, [conditional_parameter_id], redis, bypass_cache=True
    )
    return items[0]

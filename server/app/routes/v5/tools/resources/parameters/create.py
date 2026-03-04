"""Parameters CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.parameters.get import get_parameters
from app.routes.v5.tools.resources.parameters.types import GetParameterResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_parameter(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetParameterResponse:
    """Create a parameter resource (plain INSERT — no unique constraint)."""
    parameter_id = await conn.fetchval(
        """
        INSERT INTO parameters_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "parameters"], redis=redis)
    items = await get_parameters(conn, [parameter_id], redis, bypass_cache=True)
    return items[0]

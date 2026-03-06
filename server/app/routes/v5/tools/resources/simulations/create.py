"""Simulations CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.simulations.get import get_simulations
from app.routes.v5.tools.resources.simulations.types import GetSimulationResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_simulation(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetSimulationResponse:
    """Create a simulation resource (plain INSERT — no unique constraint)."""
    simulation_id = await conn.fetchval(
        """
        INSERT INTO simulations_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
    """,
        name,
        description,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "simulations"], redis=redis)
    items = await get_simulations(conn, [simulation_id], redis, bypass_cache=True)
    return items[0]

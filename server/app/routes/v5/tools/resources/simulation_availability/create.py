"""Simulation Availability CREATE — reusable data-access layer."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.simulation_availability.get import get_simulation_availability
from app.routes.v5.tools.resources.simulation_availability.types import (
    GetSimulationAvailabilityResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_simulation_availability(
    conn: asyncpg.Connection,
    simulation_id: UUID,
    time: datetime,
    availability_type: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetSimulationAvailabilityResponse:
    """Create a simulation_availability resource (ON CONFLICT on (simulation_id, type))."""
    row_id = await conn.fetchval(
        """
        INSERT INTO simulation_availability_resource
            (simulation_id, time, type, active, mcp, generated)
        VALUES ($1, $2, $3::availability_type, true, $4, $4)
        ON CONFLICT (simulation_id, type) DO UPDATE SET time = EXCLUDED.time
        RETURNING id
        """,
        simulation_id,
        time,
        availability_type,
        mcp,
    )

    await invalidate_tags(["resources", "simulation_availability"], redis=redis)
    items = await get_simulation_availability(conn, [row_id], redis, bypass_cache=True)
    return items[0]

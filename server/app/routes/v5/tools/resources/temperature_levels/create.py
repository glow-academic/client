"""Temperature Levels CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.temperature_levels.get import get_temperature_levels
from app.routes.v5.tools.resources.temperature_levels.types import (
    GetTemperatureLevelResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_temperature_level(
    conn: asyncpg.Connection,
    temperature: float,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetTemperatureLevelResponse:
    """Create a temperature_level resource (plain INSERT, no unique constraint)."""
    level_id = await conn.fetchval(
        """
        INSERT INTO temperature_levels_resource (temperature, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
        """,
        temperature,
        mcp,
    )
    await invalidate_tags(["resources", "temperature_levels"], redis=redis)
    items = await get_temperature_levels(conn, [level_id], redis, bypass_cache=True)
    return items[0]

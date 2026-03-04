"""Scenarios CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.scenarios.get import get_scenarios
from app.routes.v5.tools.resources.scenarios.types import GetScenarioResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_scenario(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetScenarioResponse:
    """Create a scenario resource (plain INSERT — no unique constraint)."""
    scenario_id = await conn.fetchval(
        """
        INSERT INTO scenarios_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "scenarios"], redis=redis)
    items = await get_scenarios(conn, [scenario_id], redis, bypass_cache=True)
    return items[0]

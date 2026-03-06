"""Agents CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.agents.types import GetAgentResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_agent(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetAgentResponse:
    """Create an agent resource (plain INSERT — no unique constraint)."""
    agent_id = await conn.fetchval(
        """
        INSERT INTO agents_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        name,
        description,
        not soft,
        mcp,
    )
    await invalidate_tags(["resources", "agents"], redis=redis)
    items = await get_agents(conn, [agent_id], redis, bypass_cache=True)
    return items[0]

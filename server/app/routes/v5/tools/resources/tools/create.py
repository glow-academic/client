"""Tools CREATE — reusable data-access layer."""
from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.tools.types import GetToolResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_tool(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetToolResponse:
    """Create a tool resource (plain INSERT — no unique constraint)."""
    new_tool_id = await conn.fetchval(
        """
        INSERT INTO tools_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        name, description, mcp,
    )
    await invalidate_tags(["resources", "tools"], redis=redis)
    items = await get_tools(conn, [new_tool_id], redis, bypass_cache=True)
    return items[0]

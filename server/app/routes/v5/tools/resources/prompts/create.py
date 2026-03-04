"""Prompts CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.prompts.get import get_prompts
from app.routes.v5.tools.resources.prompts.types import GetPromptResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_prompt(
    conn: asyncpg.Connection,
    system_prompt: str,
    name: str,
    description: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetPromptResponse:
    """Create a prompt resource."""
    prompt_id = await conn.fetchval(
        """
        INSERT INTO prompts_resource (system_prompt, name, description, active, mcp, generated)
        VALUES ($1, $2, $3, true, $4, $4)
        RETURNING id
    """,
        system_prompt,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "prompts"], redis=redis)
    items = await get_prompts(conn, [prompt_id], redis, bypass_cache=True)
    return items[0]

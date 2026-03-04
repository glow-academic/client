"""Instructions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.instructions.get import get_instructions
from app.routes.v5.tools.resources.instructions.types import GetInstructionResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_instruction(
    conn: asyncpg.Connection,
    template: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetInstructionResponse:
    """Create an instruction resource."""
    instruction_id = await conn.fetchval(
        """
        INSERT INTO instructions_resource (template, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
    """,
        template,
        mcp,
    )

    await invalidate_tags(["resources", "instructions"], redis=redis)
    items = await get_instructions(conn, [instruction_id], redis, bypass_cache=True)
    return items[0]

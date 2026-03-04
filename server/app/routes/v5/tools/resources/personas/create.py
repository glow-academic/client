"""Personas CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.personas.get import get_personas
from app.routes.v5.tools.resources.personas.types import GetPersonaResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_persona(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetPersonaResponse:
    """Create a persona resource (plain INSERT — no unique constraint)."""
    persona_id = await conn.fetchval(
        """
        INSERT INTO personas_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "personas"], redis=redis)
    items = await get_personas(conn, [persona_id], redis, bypass_cache=True)
    return items[0]

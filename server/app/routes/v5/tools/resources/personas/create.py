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
    *,
    name: str = "",
    description: str = "",
    icon: str = "",
    color: str = "",
    department_ids: list[UUID] | None = None,
    instructions: str = "",
    examples: list[str] | None = None,
    parameter_field_ids: list[UUID] | None = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetPersonaResponse:
    """Create a persona resource (denormalized snapshot)."""
    persona_id = await conn.fetchval(
        """
        INSERT INTO personas_resource (
            name, description, icon, color, department_ids,
            instructions, examples, parameter_field_ids,
            active, mcp, generated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9)
        RETURNING id
    """,
        name,
        description,
        icon,
        color,
        department_ids or [],
        instructions,
        examples or [],
        parameter_field_ids or [],
        mcp,
    )

    await invalidate_tags(["resources", "personas"], redis=redis)
    items = await get_personas(conn, [persona_id], redis, bypass_cache=True)
    return items[0]

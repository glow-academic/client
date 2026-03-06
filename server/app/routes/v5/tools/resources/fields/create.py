"""Fields CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.fields.get import get_fields
from app.routes.v5.tools.resources.fields.types import GetFieldResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_field(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetFieldResponse:
    """Create a field resource (plain INSERT — no unique constraint)."""
    field_id = await conn.fetchval(
        """
        INSERT INTO fields_resource (name, description, value, active, mcp, generated)
        VALUES ($1, $2, '', true, $3, $3)
        RETURNING id
        """,
        name,
        description,
        mcp,
    )
    await invalidate_tags(["resources", "fields"], redis=redis)
    items = await get_fields(conn, [field_id], redis, bypass_cache=True)
    return items[0]

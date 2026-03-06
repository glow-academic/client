"""Providers CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.providers.types import GetProviderResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_provider(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetProviderResponse:
    """Create a provider resource (plain INSERT — no unique constraint)."""
    provider_id = await conn.fetchval(
        """
        INSERT INTO providers_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        name,
        description,
        mcp,
    )
    await invalidate_tags(["resources", "providers"], redis=redis)
    items = await get_providers(conn, [provider_id], redis, bypass_cache=True)
    return items[0]

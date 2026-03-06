"""Profiles CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.profiles.types import GetProfileResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_profile(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetProfileResponse:
    """Create a profile resource (plain INSERT, no unique constraint)."""
    profile_id = await conn.fetchval(
        """
        INSERT INTO profiles_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        name,
        description,
        not soft,
        mcp,
    )
    await invalidate_tags(["resources", "profiles"], redis=redis)
    items = await get_profiles(conn, [profile_id], redis, bypass_cache=True)
    return items[0]

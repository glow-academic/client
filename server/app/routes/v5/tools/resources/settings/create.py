"""Settings CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.settings.get import get_settings
from app.routes.v5.tools.resources.settings.types import GetSettingResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_setting(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetSettingResponse:
    """Create a setting resource (plain INSERT — no unique constraint)."""
    setting_id = await conn.fetchval(
        """
        INSERT INTO settings_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        name,
        description,
        mcp,
    )
    await invalidate_tags(["resources", "settings"], redis=redis)
    items = await get_settings(conn, [setting_id], redis, bypass_cache=True)
    return items[0]

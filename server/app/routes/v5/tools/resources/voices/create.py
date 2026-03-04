"""Voices CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.voices.get import get_voices
from app.routes.v5.tools.resources.voices.types import GetVoiceResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_voice(
    conn: asyncpg.Connection,
    voice: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetVoiceResponse:
    """Create a voice resource."""
    voice_id = await conn.fetchval(
        """
        INSERT INTO voices_resource (voice, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
    """,
        voice,
        mcp,
    )

    await invalidate_tags(["resources", "voices"], redis=redis)
    items = await get_voices(conn, [voice_id], redis, bypass_cache=True)
    return items[0]

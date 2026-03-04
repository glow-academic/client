"""Texts CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.texts.get import get_texts
from app.routes.v5.tools.resources.texts.types import GetTextResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_text(
    conn: asyncpg.Connection,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetTextResponse:
    """Create a text resource."""
    text_id = await conn.fetchval(
        """
        INSERT INTO texts_resource (active, mcp, generated)
        VALUES (true, $1, $1)
        RETURNING id
    """,
        mcp,
    )

    await invalidate_tags(["resources", "texts"], redis=redis)
    items = await get_texts(conn, [text_id], redis, bypass_cache=True)
    return items[0]

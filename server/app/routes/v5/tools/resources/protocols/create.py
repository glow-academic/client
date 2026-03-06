"""Protocols CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.protocols.get import get_protocols
from app.routes.v5.tools.resources.protocols.types import GetProtocolResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_protocol(
    conn: asyncpg.Connection,
    value: str,
    redis: Redis,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetProtocolResponse:
    """Create a protocol resource (insert or get existing)."""
    protocol_id = await conn.fetchval(
        """
        INSERT INTO protocols_resource (value, active, mcp, generated)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (value) DO UPDATE SET value = EXCLUDED.value
        RETURNING id
    """,
        value,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "protocols"], redis=redis)
    items = await get_protocols(conn, [protocol_id], redis, bypass_cache=True)
    return items[0]

"""Modalities CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.modalities.get import get_modalities
from app.routes.v5.tools.resources.modalities.types import GetModalityResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_modality(
    conn: asyncpg.Connection,
    modality: str,
    redis: Redis,
    is_input: bool = False,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetModalityResponse:
    """Create a modality resource (plain INSERT, no unique constraint)."""
    modality_id = await conn.fetchval(
        """
        INSERT INTO modalities_resource (modality, is_input, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        modality,
        is_input,
        mcp,
    )
    await invalidate_tags(["resources", "modalities"], redis=redis)
    items = await get_modalities(conn, [modality_id], redis, bypass_cache=True)
    return items[0]

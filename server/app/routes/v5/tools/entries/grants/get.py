"""grants/get internal — reusable data-access layer."""

import json
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.globals import get_redis_client
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached


async def get_grants_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch grants entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "grants"]
    cache_key_val = cache_key(
        "/api/v5/entries/grants/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    result = await conn.fetchval(
        """
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'grant_id', m.grant_id,
            'grantor_id', m.grantor_id,
            'emulation_id', m.emulation_id,
            'emulated_id', m.emulated_id,
            'grant_session_id', m.grant_session_id,
            'emulation_session_id', m.emulation_session_id,
            'expires_at', m.expires_at,
            'created_at', m.created_at,
            'active', m.active,
            'mcp', m.mcp,
            'generated', m.generated
        )), '[]'::jsonb)
        FROM grants_mv m
        WHERE m.grant_id = ANY($1)
        """,
        ids,
    )

    items: list[dict] = (
        json.loads(result) if isinstance(result, str) else (result or [])
    )

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

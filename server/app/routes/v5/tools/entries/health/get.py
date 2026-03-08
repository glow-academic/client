"""health/get internal — reusable data-access layer."""

import json
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.globals import get_redis_client
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached


async def get_health_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch health entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "health"]
    cache_key_val = cache_key(
        "/api/v5/entries/health/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    result = await conn.fetchval(
        """
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date_hour', m.date_hour,
            'service', m.service,
            'check_count', m.check_count,
            'ok_count', m.ok_count,
            'fail_count', m.fail_count,
            'uptime_percent', m.uptime_percent,
            'avg_latency_ms', m.avg_latency_ms,
            'min_latency_ms', m.min_latency_ms,
            'max_latency_ms', m.max_latency_ms,
            'latest_ok', m.latest_ok,
            'latest_error', m.latest_error
        )), '[]'::jsonb)
        FROM health_mv m
        WHERE m.date_hour = ANY($1)
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

"""practice/get — reusable data-access layer."""

import json
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.globals import get_redis_client
from app.routes.v5.tools.entries.practice.types import GetPracticeResponse
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

MV_NAME = "practice_mv"


async def get_practices(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetPracticeResponse]:
    """Get practice entries by IDs from practice_mv."""
    if not ids:
        return []

    rows = await conn.fetch(
        f"""
        SELECT practice_id, simulation_ids, cohort_ids, department_ids,
               profile_ids, chat_ids, scenario_ids,
               created_at, updated_at, active
        FROM {MV_NAME}
        WHERE practice_id = ANY($1)
        """,
        ids,
    )

    return [
        GetPracticeResponse(
            id=r["practice_id"],
            simulation_ids=r["simulation_ids"],
            cohort_ids=r["cohort_ids"],
            department_ids=r["department_ids"],
            profile_ids=r["profile_ids"],
            chat_ids=r["chat_ids"],
            scenario_ids=r["scenario_ids"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            active=r["active"],
        )
        for r in rows
    ]


async def get_practice_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch practice entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "practice"]
    cache_key_val = cache_key(
        "/api/v5/entries/practice/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    result = await conn.fetchval(
        """
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'practice_id', m.practice_id,
            'simulation_ids', m.simulation_ids,
            'cohort_ids', m.cohort_ids,
            'department_ids', m.department_ids,
            'profile_ids', m.profile_ids,
            'chat_ids', m.chat_ids,
            'scenario_ids', m.scenario_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        )), '[]'::jsonb)
        FROM practice_mv m
        WHERE m.practice_id = ANY($1)
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

"""attempt_strength/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAttemptStrengthEntriesSqlParams,
    GetAttemptStrengthEntriesSqlRow,
    QGetSimulationStrengthsViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_strength/get_attempt_strength_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/strengths/get_simulation_strengths_view_complete.sql"

async def get_attempt_strength_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_strength entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_strength"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_strength/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptStrengthEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptStrengthEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

async def get_attempt_strength_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationStrengthsViewV4Item]:
    """Internal function for fetching strengths data."""
    from app.sql.types import GetSimulationStrengthsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_strength/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSimulationStrengthsViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationStrengthsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationStrengthsViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_strength"],
        redis=get_redis_client(),
    )
    return items

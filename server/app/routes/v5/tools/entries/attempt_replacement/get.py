"""attempt_replacement/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAttemptReplacementEntriesSqlParams,
    GetAttemptReplacementEntriesSqlRow,
    QGetSimulationReplacementsViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_replacement/get_attempt_replacement_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/replacements/get_simulation_replacements_view_complete.sql"


async def get_attempt_replacement_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_replacement entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_replacement"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_replacement/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptReplacementEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptReplacementEntriesSqlRow,
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


async def get_attempt_replacement_internal(
    conn: asyncpg.Connection,
    improvement_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationReplacementsViewV4Item]:
    """Internal function for fetching replacements data."""
    from app.sql.types import GetSimulationReplacementsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_replacement/view",
        {
            "improvement_ids": [str(x) for x in improvement_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSimulationReplacementsViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationReplacementsViewSqlParams(
        improvement_ids_filter=improvement_ids
    )
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationReplacementsViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_replacement"],
        redis=get_redis_client(),
    )
    return items

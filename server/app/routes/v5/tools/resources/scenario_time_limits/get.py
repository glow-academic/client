"""scenario_time_limits/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetScenarioTimeLimitsSqlParams,
    GetScenarioTimeLimitsSqlRow,
    QGetScenarioTimeLimitsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/scenario_time_limits/get_scenario_time_limits_complete.sql"


async def get_scenario_time_limits_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetScenarioTimeLimitsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of scenario time limit resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario time limit items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "scenario_time_limits/get",
        {
            "ids": sorted([str(id) for id in ids]),
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetScenarioTimeLimitsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetScenarioTimeLimitsSqlParams(ids=ids)
    result = cast(
        GetScenarioTimeLimitsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["scenario_time_limits"],
        redis=get_redis_client(),
    )

    return items

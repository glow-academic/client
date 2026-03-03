"""scenario_time_limits/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetScenarioTimeLimitsV4Item,
    SearchScenarioTimeLimitsSqlParams,
    SearchScenarioTimeLimitsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/scenario_time_limits/search_scenario_time_limits_complete.sql"

async def search_scenario_time_limits_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    negative: bool | None = None,
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioTimeLimitsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search time limits for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario time limit items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_time_limits/search",
        {
            "scenario_ids": sorted([str(id) for id in scenario_ids]),
            "negative": negative,
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetScenarioTimeLimitsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioTimeLimitsSqlParams(
        scenario_ids=scenario_ids or [],
        negative=negative,
        simulation=simulation,
    )
    result = cast(
        SearchScenarioTimeLimitsSqlRow,
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
    )

    return items

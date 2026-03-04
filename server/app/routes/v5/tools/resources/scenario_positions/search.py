"""scenario_positions/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetScenarioPositionsV4Item,
    SearchScenarioPositionsSqlParams,
    SearchScenarioPositionsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/scenario_positions/search_scenario_positions_complete.sql"


async def search_scenario_positions_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioPositionsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search positions for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario position items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_positions/search",
        {
            "scenario_ids": sorted([str(id) for id in scenario_ids]),
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetScenarioPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioPositionsSqlParams(
        scenario_ids=scenario_ids or [],
        simulation=simulation,
    )
    result = cast(
        SearchScenarioPositionsSqlRow,
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
        tags=["scenario_positions"],
        redis=get_redis_client(),
    )

    return items

"""scenario_rubrics/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetScenarioRubricsV4Item,
    SearchScenarioRubricsSqlParams,
    SearchScenarioRubricsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/scenario_rubrics/search_scenario_rubrics_complete.sql"
)


async def search_scenario_rubrics_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    rubric_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioRubricsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search rubrics for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario rubric items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_rubrics/search",
        {
            "scenario_ids": sorted([str(id) for id in scenario_ids]),
            "rubric_ids": sorted(str(i) for i in (rubric_ids or [])),
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetScenarioRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioRubricsSqlParams(
        scenario_ids=scenario_ids or [],
        rubric_ids=rubric_ids or [],
        simulation=simulation,
    )
    result = cast(
        SearchScenarioRubricsSqlRow,
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
        tags=["scenario_rubrics"],
        redis=get_redis_client(),
    )

    return items

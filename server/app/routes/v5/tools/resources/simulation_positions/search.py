"""simulation_positions/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.simulation_positions.types import (
    GetSimulationPositionsV4Item,
    SearchSimulationPositionsSqlRow,
)
from app.sql.types import SearchSimulationPositionsSqlParams
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulation_positions/search_simulation_positions_complete.sql"


async def search_simulation_positions_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID] | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[GetSimulationPositionsV4Item]:
    """Internal function for searching simulation positions.

    Args:
        conn: Database connection
        simulation_ids: Optional simulation IDs to filter by
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation position items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "simulation_positions/search",
        {
            "simulation_ids": [str(id) for id in (simulation_ids or [])],
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "cohort": cohort,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                GetSimulationPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchSimulationPositionsSqlParams(
        simulation_ids=simulation_ids or [],
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        cohort=cohort,
    )

    result = cast(
        SearchSimulationPositionsSqlRow,
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
        tags=["simulation_positions"],
        redis=get_redis_client(),
    )

    return items

"""simulation_positions/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.simulation_positions.types import (
    GetSimulationPositionsSqlParams,
    GetSimulationPositionsSqlRow,
    GetSimulationPositionsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulation_positions/get_simulation_positions_complete.sql"


async def get_simulation_positions_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetSimulationPositionsV4Item]:
    """Internal function for parallel fetching from cohort endpoint.

    Args:
        conn: Database connection
        simulation_ids: List of simulation IDs to fetch positions for
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation position items
    """
    if not simulation_ids:
        return []
    # Normalize to UUIDs (SQL function expects uuid[])
    simulation_ids = [
        UUID(sid) if isinstance(sid, str) else sid
        for sid in simulation_ids
        if sid is not None
    ]
    if not simulation_ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "simulation_positions/get",
        {"simulation_ids": [str(id) for id in simulation_ids]},
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
    params = GetSimulationPositionsSqlParams(simulation_ids=simulation_ids)
    result = cast(
        GetSimulationPositionsSqlRow,
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

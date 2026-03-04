"""simulations/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.simulations.types import (
    GetSimulationsSqlParams,
    GetSimulationsSqlRow,
    GetSimulationsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulations/get_simulations_complete.sql"


async def get_simulations_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetSimulationsV4Item]:
    """Internal function for fetching simulations by IDs.

    Can be called directly from other routes without HTTP overhead.

    Args:
        conn: Database connection
        ids: List of simulation IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation items
    """
    if not ids:
        return []

    tags = ["resources", "simulations"]
    cache_key_val = cache_key(
        "/api/v5/resources/simulations/get",
        {"ids": sorted(str(i) for i in ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                GetSimulationsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetSimulationsSqlParams(ids=ids)
    result = cast(
        GetSimulationsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    # Convert auto-generated Q* types to handcrafted types via dict roundtrip
    items: list[GetSimulationsV4Item] = (
        [
            GetSimulationsV4Item.model_validate(
                item.model_dump() if hasattr(item, "model_dump") else item
            )
            for item in (result.items or [])
        ]
        if result
        else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

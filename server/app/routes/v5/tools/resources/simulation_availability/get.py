"""simulation_availability/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg

from app.routes.v5.api.resources.simulation_availability.types import (
    GetSimulationAvailabilitySqlParams,
    GetSimulationAvailabilitySqlRow,
    SimulationAvailabilityV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulation_availability/get_simulation_availability_complete.sql"

async def get_simulation_availability_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[SimulationAvailabilityV4Item]:
    if not ids:
        return []

    ids = [UUID(sid) if isinstance(sid, str) else sid for sid in ids if sid is not None]
    if not ids:
        return []

    cache_key_val = cache_key(
        "simulation_availability/get",
        {"ids": sorted([str(id) for id in ids])},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                SimulationAvailabilityV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    params = GetSimulationAvailabilitySqlParams(ids=ids)
    result = cast(
        GetSimulationAvailabilitySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items or []

    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["simulation_availability"],
        redis=get_redis_client(),
    )

    return items

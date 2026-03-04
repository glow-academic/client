"""simulation_availability/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg

from app.routes.v5.api.resources.simulation_availability.types import (
    SearchSimulationAvailabilitySqlParams,
    SearchSimulationAvailabilitySqlRow,
    SimulationAvailabilityV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulation_availability/search_simulation_availability_complete.sql"


async def search_simulation_availability_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID] | None = None,
    availability_type: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[SimulationAvailabilityV4Item]:
    cache_key_val = cache_key(
        "simulation_availability/search",
        {
            "simulation_ids": sorted([str(id) for id in (simulation_ids or [])]),
            "availability_type": availability_type,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": sorted([str(id) for id in (exclude_ids or [])]),
            "cohort": cohort,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                SimulationAvailabilityV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    params = SearchSimulationAvailabilitySqlParams(
        simulation_ids=simulation_ids or [],
        availability_type=availability_type,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        cohort=cohort,
    )

    result = cast(
        SearchSimulationAvailabilitySqlRow,
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

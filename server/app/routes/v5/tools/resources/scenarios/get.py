"""scenarios/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.main.simulation.types import (
    GetScenariosSqlParams,
    GetScenariosSqlRow,
    QGetScenariosV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/scenarios/get_scenarios_complete.sql"

async def get_scenarios_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetScenariosV4Item]:
    """Internal function to fetch scenarios by IDs.

    Args:
        conn: Database connection
        ids: List of scenario IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario items
    """
    if not ids:
        return []

    tags = ["resources", "scenarios"]
    cache_key_val = cache_key(
        "/api/v5/resources/scenarios/get", {"ids": [str(i) for i in ids]}
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached and "items" in cached:
            return [
                QGetScenariosV4Item.model_validate(item) for item in cached["items"]
            ]

    params = GetScenariosSqlParams(ids=ids)

    result = cast(
        GetScenariosSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items or []

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

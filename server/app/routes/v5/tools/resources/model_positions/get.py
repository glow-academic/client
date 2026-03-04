"""model_positions/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetModelPositionsSqlParams,
    GetModelPositionsSqlRow,
    QGetModelPositionsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/model_positions/get_model_positions_complete.sql"
)

async def get_model_positions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetModelPositionsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of model position resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of model position items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "model_positions/get",
        {
            "ids": sorted([str(id) for id in ids]),
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetModelPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetModelPositionsSqlParams(ids=ids)
    result = cast(
        GetModelPositionsSqlRow,
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
        tags=["model_positions"],
        redis=get_redis_client(),
    )

    return items

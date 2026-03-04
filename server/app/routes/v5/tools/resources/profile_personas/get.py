"""profile_personas/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetProfilePersonasSqlParams,
    GetProfilePersonasSqlRow,
    QGetProfilePersonasV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/profile_personas/get_profile_personas_complete.sql"
)

async def get_profile_personas_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProfilePersonasV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of profile persona resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of profile persona items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "profile_personas/get",
        {
            "ids": sorted([str(id) for id in ids]),
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetProfilePersonasV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetProfilePersonasSqlParams(ids=ids)
    result = cast(
        GetProfilePersonasSqlRow,
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
        tags=["profile_personas"],
        redis=get_redis_client(),
    )

    return items

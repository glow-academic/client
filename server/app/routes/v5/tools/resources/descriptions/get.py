"""descriptions/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetDescriptionsSqlParams,
    GetDescriptionsSqlRow,
    QGetDescriptionsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/descriptions/get_descriptions_complete.sql"


async def get_descriptions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetDescriptionsV4Item]:
    """Internal function to fetch descriptions by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "descriptions"]
    cache_key_val = cache_key(
        "/api/v5/resources/descriptions/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetDescriptionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetDescriptionsSqlParams(ids=ids)
    result = cast(
        GetDescriptionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetDescriptionsV4Item] = (
        result.items if result and result.items else []
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

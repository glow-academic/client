"""entries/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetEntriesSqlParams,
    GetEntriesSqlRow,
    QGetEntriesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/entries/get_entries_complete.sql"


async def get_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetEntriesV4Item]:
    """Internal function to fetch entries by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "entries"]
    cache_key_val = cache_key(
        "/api/v5/resources/entries/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetEntriesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetEntriesSqlParams(ids=ids)
    result = cast(
        GetEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetEntriesV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

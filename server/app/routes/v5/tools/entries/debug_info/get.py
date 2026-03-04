"""debug_info/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetDebugInfoEntriesSqlParams,
    GetDebugInfoEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/debug_info/get_debug_info_entries_complete.sql"


async def get_debug_info_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch debug_info entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "debug_info"]
    cache_key_val = cache_key(
        "/api/v5/entries/debug_info/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetDebugInfoEntriesSqlParams(ids=ids)
    result = cast(
        GetDebugInfoEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

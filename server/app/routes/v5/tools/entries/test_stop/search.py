"""test_stop/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchTestStopEntriesSqlParams,
    SearchTestStopEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/test_stop/search_test_stop_entries_complete.sql"


async def search_test_stop_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    invocation_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search test_stop entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "test_stop"]
    cache_key_val = cache_key(
        "/api/v5/entries/test_stop/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "invocation_id": str(invocation_id) if invocation_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchTestStopEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        invocation_id=invocation_id,
    )
    result = cast(
        SearchTestStopEntriesSqlRow,
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

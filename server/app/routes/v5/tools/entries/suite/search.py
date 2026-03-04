"""suite/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchSuiteEntriesSqlParams,
    SearchSuiteEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/suite/search_suite_entries_complete.sql"

async def search_suite_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    benchmark_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search suite entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "suite"]
    cache_key_val = cache_key(
        "/api/v5/entries/suite/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "benchmark_id": str(benchmark_id) if benchmark_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchSuiteEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        benchmark_id=benchmark_id,
    )
    result = cast(
        SearchSuiteEntriesSqlRow,
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

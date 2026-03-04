"""resolves/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchResolvesEntriesSqlParams,
    SearchResolvesEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/resolves/search_resolves_entries_complete.sql"


async def search_resolves_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    problem_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search resolves entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "resolves"]
    cache_key_val = cache_key(
        "/api/v5/entries/resolves/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "problem_id": str(problem_id) if problem_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchResolvesEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        problem_id=problem_id,
    )
    result = cast(
        SearchResolvesEntriesSqlRow,
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

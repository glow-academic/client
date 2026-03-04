"""calls/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchCallsEntriesSqlParams,
    SearchCallsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/calls/search_calls_entries_complete.sql"


async def search_calls_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search calls entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "calls"]
    cache_key_val = cache_key(
        "/api/v5/entries/calls/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "run_id": str(run_id) if run_id else None,
            "tool_id": str(tool_id) if tool_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchCallsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        run_id=run_id,
        tool_id=tool_id,
    )
    result = cast(
        SearchCallsEntriesSqlRow,
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

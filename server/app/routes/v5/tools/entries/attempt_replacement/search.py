"""attempt_replacement/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchAttemptReplacementEntriesSqlParams,
    SearchAttemptReplacementEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_replacement/search_attempt_replacement_entries_complete.sql"

async def search_attempt_replacement_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    improvement_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt_replacement entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt_replacement"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_replacement/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "improvement_id": str(improvement_id) if improvement_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptReplacementEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        improvement_id=improvement_id,
    )
    result = cast(
        SearchAttemptReplacementEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items

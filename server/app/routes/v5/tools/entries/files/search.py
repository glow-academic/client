"""files/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchFilesEntriesSqlParams,
    SearchFilesEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/files/search_files_entries_complete.sql"

async def search_files_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    uploads_id: UUID | None = None,
    mime_type: str | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search files entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "files"]
    cache_key_val = cache_key(
        "/api/v5/entries/files/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "uploads_id": str(uploads_id) if uploads_id else None,
            "mime_type": mime_type,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchFilesEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        uploads_id=uploads_id,
        mime_type=mime_type,
    )
    result = cast(
        SearchFilesEntriesSqlRow,
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

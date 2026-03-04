"""audios/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchAudiosEntriesSqlParams,
    SearchAudiosEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/audios/search_audios_entries_complete.sql"


async def search_audios_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    files_id: UUID | None = None,
    voice_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search audios entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "audios"]
    cache_key_val = cache_key(
        "/api/v5/entries/audios/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "files_id": str(files_id) if files_id else None,
            "voice_id": str(voice_id) if voice_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchAudiosEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        files_id=files_id,
        voice_id=voice_id,
    )
    result = cast(
        SearchAudiosEntriesSqlRow,
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

"""logins/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchLoginsEntriesSqlParams,
    SearchLoginsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/logins/search_logins_entries_complete.sql"

async def search_logins_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    profile_id: UUID | None = None,
    session_id: UUID | None = None,
    call_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search logins entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "logins"]
    cache_key_val = cache_key(
        "/api/v5/entries/logins/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "profile_id": str(profile_id) if profile_id else None,
            "session_id": str(session_id) if session_id else None,
            "call_id": str(call_id) if call_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchLoginsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        profile_id=profile_id,
        session_id=session_id,
        call_id=call_id,
    )
    result = cast(
        SearchLoginsEntriesSqlRow,
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

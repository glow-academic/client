"""grants/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchGrantsEntriesSqlParams,
    SearchGrantsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/grants/search_grants_entries_complete.sql"

async def search_grants_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    grantor_id: UUID | None = None,
    emulation_id: UUID | None = None,
    emulated_id: UUID | None = None,
    grant_session_id: UUID | None = None,
    emulation_session_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search grants entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "grants"]
    cache_key_val = cache_key(
        "/api/v5/entries/grants/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "grantor_id": str(grantor_id) if grantor_id else None,
            "emulation_id": str(emulation_id) if emulation_id else None,
            "emulated_id": str(emulated_id) if emulated_id else None,
            "grant_session_id": str(grant_session_id) if grant_session_id else None,
            "emulation_session_id": str(emulation_session_id)
            if emulation_session_id
            else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchGrantsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        grantor_id=grantor_id,
        emulation_id=emulation_id,
        emulated_id=emulated_id,
        grant_session_id=grant_session_id,
        emulation_session_id=emulation_session_id,
    )
    result = cast(
        SearchGrantsEntriesSqlRow,
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

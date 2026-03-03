"""home/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetHomeContextViewSqlRow,
    GetHomeEntriesSqlParams,
    GetHomeEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/home/get_home_entries_complete.sql"

VIEW_SQL_PATH = (
    "app/sql/queries/views/home/context/get_home_context_view_complete.sql"
)

async def get_home_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetHomeContextViewSqlRow:
    """Internal function for IDs-first home context data."""
    from app.sql.types import GetHomeContextViewSqlParams

    cache_key_val = cache_key(
        "views/home/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHomeContextViewSqlRow.model_validate(cached)

    params = GetHomeContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetHomeContextViewSqlRow(
        items=list(result.items) if result and result.items else [],
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "home", "context"],
    )

    return response

async def get_home_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch home entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "home"]
    cache_key_val = cache_key(
        "/api/v5/entries/home/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetHomeEntriesSqlParams(ids=ids)
    result = cast(
        GetHomeEntriesSqlRow,
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

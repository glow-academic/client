"""grants/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetGrantListViewSqlRow,
    GetGrantsEntriesSqlParams,
    GetGrantsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/grants/get_grants_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/grant/list/get_grant_list_view_complete.sql"

async def get_grants_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch grants entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "grants"]
    cache_key_val = cache_key(
        "/api/v5/entries/grants/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetGrantsEntriesSqlParams(ids=ids)
    result = cast(
        GetGrantsEntriesSqlRow,
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

async def get_grant_list_view_internal(
    conn: asyncpg.Connection,
    grantor_id_filter: UUID | None = None,
    emulated_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetGrantListViewSqlRow:
    """Internal function for fetching grants data from MV."""
    from app.sql.types import GetGrantListViewSqlParams

    cache_key_val = cache_key(
        "views/grant/list/get",
        {
            "grantor_id_filter": str(grantor_id_filter) if grantor_id_filter else None,
            "emulated_id_filter": str(emulated_id_filter)
            if emulated_id_filter
            else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGrantListViewSqlRow.model_validate(cached)

    params = GetGrantListViewSqlParams(
        grantor_id_filter=grantor_id_filter,
        emulated_id_filter=emulated_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetGrantListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "grant", "list"],
    )

    return response

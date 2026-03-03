"""calls/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetCallListViewSqlRow,
    GetCallsEntriesSqlParams,
    GetCallsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/calls/get_calls_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/call/list/get_call_list_view_complete.sql"

async def get_calls_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch calls entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "calls"]
    cache_key_val = cache_key(
        "/api/v5/entries/calls/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetCallsEntriesSqlParams(ids=ids)
    result = cast(
        GetCallsEntriesSqlRow,
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

async def get_call_list_view_internal(
    conn: asyncpg.Connection,
    run_id_filter: UUID | None = None,
    run_ids: list[UUID] | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetCallListViewSqlRow:
    """Internal function for fetching calls data from MV."""
    from app.sql.types import GetCallListViewSqlParams

    cache_key_val = cache_key(
        "views/call/list/get",
        {
            "run_id_filter": str(run_id_filter) if run_id_filter else None,
            "run_ids": [str(r) for r in run_ids] if run_ids else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetCallListViewSqlRow.model_validate(cached)

    params = GetCallListViewSqlParams(
        run_id_filter=run_id_filter,
        run_ids=run_ids,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetCallListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "call", "list"],
    )

    return response

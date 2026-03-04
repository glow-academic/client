"""activity/get internal — reusable data-access layer."""

from datetime import date
from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetActivityEntriesSqlParams,
    GetActivityEntriesSqlRow,
    GetActivityListViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/activity/get_activity_entries_complete.sql"

VIEW_SQL_PATH = (
    "app/sql/queries/views/activity/list/get_activity_list_view_complete.sql"
)

async def get_activity_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch activity entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "activity"]
    cache_key_val = cache_key(
        "/api/v5/entries/activity/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetActivityEntriesSqlParams(ids=ids)
    result = cast(
        GetActivityEntriesSqlRow,
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

async def get_activity_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    session_id_filter: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityListViewSqlRow:
    """Internal function for fetching activity data from MV."""
    from app.sql.types import GetActivityListViewSqlParams

    cache_key_val = cache_key(
        "views/activity/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "date_from": str(date_from) if date_from else None,
            "date_to": str(date_to) if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetActivityListViewSqlRow.model_validate(cached)

    params = GetActivityListViewSqlParams(
        profile_id_filter=profile_id_filter,
        session_id_filter=session_id_filter,
        date_from=date_from,
        date_to=date_to,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetActivityListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "list"],
        redis=get_redis_client(),
    )

    return response

"""messages/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetMessageListViewSqlRow,
    SearchMessagesEntriesSqlParams,
    SearchMessagesEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SEARCH_SQL_PATH = (
    "app/sql/queries/entries/messages/search_messages_entries_complete.sql"
)

LIST_SQL_PATH = "app/sql/queries/views/message/list/get_message_list_view_complete.sql"


async def search_messages_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    run_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search messages entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "messages"]
    cache_key_val = cache_key(
        "/api/v5/entries/messages/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "run_id": str(run_id) if run_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchMessagesEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        run_id=run_id,
    )
    result = cast(
        SearchMessagesEntriesSqlRow,
        await execute_sql_typed(conn, SEARCH_SQL_PATH, params=params),
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


async def get_message_list_entries_internal(
    conn: asyncpg.Connection,
    run_id_filter: UUID | None = None,
    run_ids: list[UUID] | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMessageListViewSqlRow:
    """Internal function for fetching message data from messages_mv."""
    from app.sql.types import GetMessageListViewSqlParams

    cache_key_val = cache_key(
        "entries/messages/list/get",
        {
            "run_id_filter": str(run_id_filter) if run_id_filter else None,
            "run_ids": [str(r) for r in run_ids] if run_ids else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetMessageListViewSqlRow.model_validate(cached)

    params = GetMessageListViewSqlParams(
        run_id_filter=run_id_filter,
        run_ids=run_ids,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    response = GetMessageListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "messages", "list"],
        redis=get_redis_client(),
    )

    return response

"""test_invocation/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetTestInvocationEntriesSqlParams,
    GetTestInvocationEntriesSqlRow,
    QGetTestInvocationViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/test_invocation/get_test_invocation_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/benchmark/invocations/get_test_invocation_view_complete.sql"

async def get_test_invocation_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch test_invocation entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "test_invocation"]
    cache_key_val = cache_key(
        "/api/v5/entries/test_invocation/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetTestInvocationEntriesSqlParams(ids=ids)
    result = cast(
        GetTestInvocationEntriesSqlRow,
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

async def get_test_invocation_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    invocation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetTestInvocationViewV4Item]:
    """Internal function for reading lean benchmark invocation rows."""
    from app.sql.types import GetTestInvocationViewSqlParams

    normalized_invocation_ids = invocation_ids or []
    cache_key_val = cache_key(
        "views/benchmark/invocations/get",
        {
            "test_id": str(test_id) if test_id else None,
            "invocation_ids": [str(i) for i in normalized_invocation_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetTestInvocationViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetTestInvocationViewSqlParams(
        test_id_filter=test_id,
        invocation_ids_filter=normalized_invocation_ids or None,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetTestInvocationViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "benchmark", "invocations"],
        redis=get_redis_client(),
    )

    return items

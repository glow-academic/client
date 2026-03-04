"""attempt_content/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAttemptContentEntriesSqlParams,
    GetAttemptContentEntriesSqlRow,
    QGetSimulationContentsViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_content/get_attempt_content_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/contents/get_simulation_contents_view_complete.sql"

async def get_attempt_content_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_content entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_content"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_content/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptContentEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptContentEntriesSqlRow,
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

async def get_attempt_content_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationContentsViewV4Item]:
    """Internal function for fetching contents data."""
    from app.sql.types import GetSimulationContentsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_content/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSimulationContentsViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationContentsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationContentsViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_content"],
        redis=get_redis_client(),
    )
    return items

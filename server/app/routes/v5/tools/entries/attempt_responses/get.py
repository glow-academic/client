"""attempt_responses/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetResponsesEntriesSqlParams,
    GetResponsesEntriesSqlRow,
    QGetSimulationResponsesViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/responses/get_responses_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/responses/get_simulation_responses_view_complete.sql"


async def get_simulation_responses_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationResponsesViewV4Item]:
    """Internal function for fetching responses data."""
    from app.sql.types import GetSimulationResponsesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_responses/view",
        {
            "chat_ids": [str(x) for x in chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSimulationResponsesViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationResponsesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationResponsesViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_responses"],
        redis=get_redis_client(),
    )
    return items


async def get_responses_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch responses entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_responses"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt-responses/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetResponsesEntriesSqlParams(ids=ids)
    result = cast(
        GetResponsesEntriesSqlRow,
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

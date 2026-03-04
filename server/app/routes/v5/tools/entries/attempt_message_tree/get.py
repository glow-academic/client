"""attempt_message_tree/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAttemptMessageTreeEntriesSqlParams,
    GetAttemptMessageTreeEntriesSqlRow,
    QGetSimulationMessageTreeViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_message_tree/get_attempt_message_tree_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/message_tree/get_simulation_message_tree_view_complete.sql"


async def get_attempt_message_tree_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_message_tree entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_message_tree"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_message_tree/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptMessageTreeEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptMessageTreeEntriesSqlRow,
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


async def get_attempt_message_tree_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationMessageTreeViewV4Item]:
    """Internal function for fetching message_tree data."""
    from app.sql.types import GetSimulationMessageTreeViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_message_tree/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSimulationMessageTreeViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationMessageTreeViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationMessageTreeViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_message_tree"],
        redis=get_redis_client(),
    )
    return items

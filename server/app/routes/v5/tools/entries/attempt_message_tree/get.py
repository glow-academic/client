"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_message_tree.types import (
    GetAttemptMessageTreeResponse,
)

MV_NAME = "attempt_message_tree_mv"


async def get_attempt_message_trees(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetAttemptMessageTreeResponse]:
    """Get attempt_message_tree entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE message_id = ANY($1)", ids)
    return [GetAttemptMessageTreeResponse(**dict(r)) for r in rows]


async def get_attempt_message_tree_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list:
    """Internal function for fetching message_tree data (view layer)."""
    from app.sql.types import (
        GetSimulationMessageTreeViewSqlParams,
        QGetSimulationMessageTreeViewV4Item,
    )
    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached
    from app.utils.cache.set_cached import set_cached
    from app.utils.sql_helper import execute_sql_typed

    VIEW_SQL_PATH = "app/sql/queries/views/simulation/message_tree/get_simulation_message_tree_view_complete.sql"

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

"""attempt_message/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAttemptMessageEntriesSqlParams,
    GetAttemptMessageEntriesSqlRow,
    QGetSimulationMessagesViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_message/get_attempt_message_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/simulation/messages/get_simulation_messages_view_complete.sql"

async def get_attempt_message_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_message entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_message"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_message/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptMessageEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptMessageEntriesSqlRow,
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

async def get_attempt_message_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[QGetSimulationMessagesViewV4Item]:
    """Internal function for fetching messages data."""
    from app.sql.types import GetSimulationMessagesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_message/view",
        {
            "attempt_id": str(attempt_id),
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSimulationMessagesViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationMessagesViewSqlParams(attempt_id_filter=attempt_id)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationMessagesViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_message"],
    )
    return items

"""Chat entry GET endpoint — canonical entry-level get from chat_mv."""

from typing import cast
from uuid import UUID

import asyncpg

from app.sql.types import (
    GetChatEntriesSqlParams,
    GetChatEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# ---------------------------------------------------------------------------
# Entry-level get from chat_mv (canonical entry get)
# ---------------------------------------------------------------------------

CHAT_ENTRIES_SQL_PATH = "app/sql/v4/queries/entries/chat/get_chat_entries_complete.sql"


async def get_chat_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch chat entries by IDs from chat_mv."""
    if not ids:
        return []

    tags = ["entries", "chat"]
    cache_key_val = cache_key(
        "/api/v4/entries/chat/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetChatEntriesSqlParams(ids=ids)
    result = cast(
        GetChatEntriesSqlRow,
        await execute_sql_typed(conn, CHAT_ENTRIES_SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items

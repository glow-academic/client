"""tool_drafts/get internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetToolDraftsEntriesSqlParams,
    QGetToolDraftsEntriesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/tool_drafts/get_tool_drafts_entries_complete.sql"

async def get_tool_drafts_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetToolDraftsEntriesV4Item]:
    """Internal function to fetch tool_drafts entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "tool_drafts"]
    cache_key_val = cache_key(
        "/api/v5/entries/tool_drafts/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetToolDraftsEntriesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetToolDraftsEntriesSqlParams(ids=ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[QGetToolDraftsEntriesV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

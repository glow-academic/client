"""profile_drafts/get internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetProfileDraftsEntriesSqlParams,
    QGetProfileDraftsEntriesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/entries/profile_drafts/get_profile_drafts_entries_complete.sql"
)


async def get_profile_drafts_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProfileDraftsEntriesV4Item]:
    """Internal function to fetch profile_drafts entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "profile_drafts"]
    cache_key_val = cache_key(
        "/api/v5/entries/profile_drafts/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetProfileDraftsEntriesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProfileDraftsEntriesSqlParams(ids=ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[QGetProfileDraftsEntriesV4Item] = (
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

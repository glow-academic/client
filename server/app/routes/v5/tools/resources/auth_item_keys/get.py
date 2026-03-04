"""auth_item_keys/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetAuthItemKeysSqlParams,
    GetAuthItemKeysSqlRow,
    QGetAuthItemKeysV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/auth_item_keys/get_auth_item_keys_complete.sql"

async def get_auth_item_keys_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetAuthItemKeysV4Item]:
    """Internal function to fetch auth_item_keys by IDs."""
    if not ids:
        return []

    tags = ["resources", "auth_item_keys"]
    cache_key_val = cache_key(
        "/api/v5/resources/auth_item_keys/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetAuthItemKeysV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetAuthItemKeysSqlParams(ids=ids)
    result = cast(
        GetAuthItemKeysSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetAuthItemKeysV4Item] = (
        result.items if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

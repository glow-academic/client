"""request_limits/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetRequestLimitsSqlParams,
    GetRequestLimitsSqlRow,
    QGetRequestLimitsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/request_limits/get_request_limits_complete.sql"

async def get_request_limits_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetRequestLimitsV4Item]:
    """Internal function to fetch request_limits by IDs."""
    if not ids:
        return []

    tags = ["resources", "request_limits"]
    cache_key_val = cache_key(
        "/api/v5/resources/request_limits/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetRequestLimitsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetRequestLimitsSqlParams(ids=ids)
    result = cast(
        GetRequestLimitsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRequestLimitsV4Item] = (
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

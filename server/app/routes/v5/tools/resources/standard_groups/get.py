"""standard_groups/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetStandardGroupsSqlParams,
    GetStandardGroupsSqlRow,
    QGetStandardGroupsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = (
    "app/sql/queries/resources/standard_groups/get_standard_groups_complete.sql"
)


async def get_standard_groups_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetStandardGroupsV4Item]:
    """Internal function for batch fetching standard_groups by IDs.

    This is a simple fetch with active flag check.
    """
    if not ids:
        return []

    tags = ["resources", "standard_groups"]
    cache_key_val = cache_key(
        "/api/v5/resources/standard_groups/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetStandardGroupsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetStandardGroupsSqlParams(p_ids=ids)
    result = cast(
        GetStandardGroupsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetStandardGroupsV4Item] = (
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

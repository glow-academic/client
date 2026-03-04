"""arg_positions/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetArgPositionsV4Item,
    SearchArgPositionsSqlParams,
    SearchArgPositionsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/arg_positions/search_arg_positions_complete.sql"


async def search_arg_positions_internal(
    conn: asyncpg.Connection,
    args_ids: list[UUID] | None = None,
    limit_count: int | None = 100,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    tool: bool = False,
) -> list[QGetArgPositionsV4Item]:
    """Internal function to search arg_positions."""
    tags = ["resources", "arg_positions"]
    cache_key_val = cache_key(
        "/api/v5/resources/arg_positions/search",
        {
            "args_ids": sorted([str(id) for id in (args_ids or [])]),
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": sorted([str(id) for id in (exclude_ids or [])]),
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetArgPositionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchArgPositionsSqlParams(
        args_ids=args_ids or [],
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        tool=tool,
    )
    result = cast(
        SearchArgPositionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgPositionsV4Item] = (
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

"""endpoints/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetEndpointsV4Item,
    SearchEndpointsSqlParams,
    SearchEndpointsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/endpoints/search_endpoints_complete.sql"

async def search_endpoints_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    provider: bool = False,
) -> list[QGetEndpointsV4Item]:
    """Internal function to search endpoints."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "endpoints"]
    cache_key_val = cache_key(
        "/api/v5/resources/endpoints/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "provider": provider,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetEndpointsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchEndpointsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        provider=provider,
    )
    result = cast(
        SearchEndpointsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetEndpointsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

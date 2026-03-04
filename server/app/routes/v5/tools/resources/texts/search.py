"""texts/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetTextsV4Item,
    SearchTextsSqlParams,
    SearchTextsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/texts/search_texts_complete.sql"


async def search_texts_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetTextsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "texts"]
    cache_key_val = cache_key(
        "/api/v5/resources/texts/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetTextsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = SearchTextsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
    )
    result = cast(
        SearchTextsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetTextsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

"""values/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetValuesV4Item,
    SearchValuesSqlParams,
    SearchValuesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/values/search_values_complete.sql"

async def search_values_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    model: bool = False,
    provider: bool = False,
) -> list[QGetValuesV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "values"]
    cache_key_val = cache_key(
        "/api/v5/resources/values/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "model": model,
            "provider": provider,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetValuesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchValuesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        model=model,
        provider=provider,
    )
    result = cast(
        SearchValuesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetValuesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

"""auth_item_keys/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetAuthItemKeysV4Item,
    SearchAuthItemKeysSqlParams,
    SearchAuthItemKeysSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/auth_item_keys/search_auth_item_keys_complete.sql"
)

async def search_auth_item_keys_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    auth_ids: list[UUID] | None = None,
    key_ids: list[UUID] | None = None,
    item_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    setting: bool = False,
) -> list[QGetAuthItemKeysV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "auth_item_keys"]
    cache_key_val = cache_key(
        "/api/v5/resources/auth_item_keys/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "auth_ids": sorted(str(i) for i in (auth_ids or [])),
            "key_ids": sorted(str(i) for i in (key_ids or [])),
            "item_ids": sorted(str(i) for i in (item_ids or [])),
            "setting": setting,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetAuthItemKeysV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchAuthItemKeysSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        auth_ids=auth_ids or [],
        key_ids=key_ids or [],
        item_ids=item_ids or [],
        setting=setting,
    )
    result = cast(
        SearchAuthItemKeysSqlRow,
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
    )

    return items

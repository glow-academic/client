"""args/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetArgsSqlParams,
    GetArgsSqlRow,
    QGetArgsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/args/get_args_complete.sql"

async def get_args_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetArgsV4Item]:
    """Internal function to fetch args by IDs."""
    if not ids:
        return []

    tags = ["resources", "args"]
    cache_key_val = cache_key(
        "/api/v5/resources/args/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetArgsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = GetArgsSqlParams(ids=ids)
    result = cast(
        GetArgsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

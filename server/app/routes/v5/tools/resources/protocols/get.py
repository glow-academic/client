"""protocols/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetProtocolsSqlParams,
    GetProtocolsSqlRow,
    QGetProtocolsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/protocols/get_protocols_complete.sql"

async def get_protocols_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProtocolsV4Item]:
    """Internal function to fetch protocols by IDs."""
    if not ids:
        return []

    tags = ["resources", "protocols"]
    cache_key_val = cache_key(
        "/api/v5/resources/protocols/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProtocolsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProtocolsSqlParams(ids=ids)
    result = cast(
        GetProtocolsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetProtocolsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

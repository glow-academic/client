"""standards/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetStandardsSqlParams,
    GetStandardsSqlRow,
    QGetStandardsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = "app/sql/queries/resources/standards/get_standards_complete.sql"

async def get_standards_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetStandardsV4Item]:
    """Internal function for batch fetching standards by IDs.

    This is a simple fetch with active flag check.
    """
    if not ids:
        return []

    tags = ["resources", "standards"]
    cache_key_val = cache_key(
        "/api/v5/resources/standards/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetStandardsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetStandardsSqlParams(p_ids=ids)
    result = cast(
        GetStandardsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetStandardsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

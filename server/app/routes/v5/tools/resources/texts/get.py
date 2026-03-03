"""texts/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetTextsSqlParams,
    GetTextsSqlRow,
    QGetTextsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = "app/sql/queries/resources/texts/get_texts_complete.sql"

async def get_texts_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetTextsV4Item]:
    """Internal function for batch fetching texts by IDs."""
    if not ids:
        return []

    tags = ["resources", "texts"]
    cache_key_val = cache_key(
        "/api/v5/resources/texts/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetTextsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = GetTextsSqlParams(p_ids=ids)
    result = cast(
        GetTextsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetTextsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

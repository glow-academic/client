"""uploads/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetUploadsSqlParams,
    GetUploadsSqlRow,
    QGetUploadsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/uploads/get_uploads_complete.sql"

async def get_uploads_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetUploadsV4Item]:
    """Internal function to fetch uploads by IDs."""
    if not ids:
        return []

    tags = ["resources", "uploads"]
    cache_key_val = cache_key(
        "/api/v5/resources/uploads/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetUploadsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetUploadsSqlParams(ids=ids)
    result = cast(
        GetUploadsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetUploadsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

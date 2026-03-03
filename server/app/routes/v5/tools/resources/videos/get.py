"""videos/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.videos.types import (
    GetVideoSqlParams,
    GetVideoSqlRow,
    GetVideoV4Item,
)
from app.sql.types import (
    GetVideosSqlParams,
    GetVideosSqlRow,
    QGetVideosV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/videos/get_video_complete.sql"

BATCH_SQL_PATH = "app/sql/queries/resources/videos/get_videos_complete.sql"

async def get_video_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetVideoV4Item | None:
    """Internal function for fetching a single video."""
    cache_key_val = cache_key("videos/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetVideoV4Item.model_validate(item_data)
            return None

    params = GetVideoSqlParams(id=id)
    result = cast(
        GetVideoSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["videos"],
    )

    return item

async def get_videos_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetVideosV4Item]:
    """Internal function for batch fetching videos by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "videos"]
    cache_key_val = cache_key(
        "/api/v5/resources/videos/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetVideosV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetVideosSqlParams(p_ids=ids)
    result = cast(
        GetVideosSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetVideosV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

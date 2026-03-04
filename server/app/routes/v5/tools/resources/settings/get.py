"""settings/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.settings.types import (
    GetSettingsSqlParams,
    GetSettingsSqlRow,
    QGetSettingsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/settings/get_settings_complete.sql"

async def get_settings_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSettingsV4Item]:
    """Internal function to fetch settings by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "settings"]
    cache_key_val = cache_key(
        "/api/v5/resources/settings/get",
        {"ids": sorted(str(i) for i in ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetSettingsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetSettingsSqlParams(ids=ids)
    result = cast(
        GetSettingsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetSettingsV4Item] = (
        [
            QGetSettingsV4Item.model_validate(
                item.model_dump() if hasattr(item, "model_dump") else item
            )
            for item in (result.items or [])
        ]
        if result
        else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

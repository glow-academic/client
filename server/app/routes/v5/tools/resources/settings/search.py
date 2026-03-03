"""settings/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetSettingsV4Item,
    SearchSettingsSqlParams,
    SearchSettingsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/settings/search_settings_complete.sql"

async def search_settings_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    agent_ids: list[UUID] | None = None,
    provider_key_ids: list[UUID] | None = None,
    auth_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    department: bool = False,
    setting: bool = False,
) -> list[QGetSettingsV4Item]:
    """Internal function to search settings."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "settings"]
    cache_key_val = cache_key(
        "/api/v5/resources/settings/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "agent_ids": sorted(str(i) for i in (agent_ids or [])),
            "provider_key_ids": sorted(str(i) for i in (provider_key_ids or [])),
            "auth_ids": sorted(str(i) for i in (auth_ids or [])),
            "department": department,
            "setting": setting,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSettingsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchSettingsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        agent_ids=agent_ids or [],
        provider_key_ids=provider_key_ids or [],
        auth_ids=auth_ids or [],
        department=department,
        setting=setting,
    )
    result = cast(
        SearchSettingsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetSettingsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

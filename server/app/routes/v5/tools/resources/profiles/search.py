"""profiles/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetProfilesV4Item,
    SearchProfilesSqlParams,
    SearchProfilesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/profiles/search_profiles_complete.sql"

async def search_profiles_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    cohort_ids: list[UUID] | None = None,
    role_ids: list[UUID] | None = None,
    role: str | None = None,
    bypass_cache: bool = False,
    *,
    profile: bool = False,
    setting: bool = False,
) -> list[QGetProfilesV4Item]:
    """Internal function to search profiles."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "profiles"]
    cache_key_val = cache_key(
        "/api/v5/resources/profiles/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "cohort_ids": sorted(str(i) for i in (cohort_ids or [])),
            "role_ids": sorted(str(i) for i in (role_ids or [])),
            "role": role,
            "profile": profile,
            "setting": setting,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetProfilesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchProfilesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        cohort_ids=cohort_ids or [],
        role_ids=role_ids or [],
        role=role,
        profile=profile,
        setting=setting,
    )
    result = cast(
        SearchProfilesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetProfilesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

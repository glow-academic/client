"""rubrics/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetRubricsV4Item,
    SearchRubricsSqlParams,
    SearchRubricsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/rubrics/search_rubrics_complete.sql"


async def search_rubrics_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_rubric: bool | None = None,
    video_rubric: bool | None = None,
    standard_group_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    rubric: bool = False,
) -> list[QGetRubricsV4Item]:
    """Internal function to search rubrics."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "rubrics"]
    cache_key_val = cache_key(
        "/api/v5/resources/rubrics/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "simulation_rubric": simulation_rubric,
            "video_rubric": video_rubric,
            "standard_group_ids": sorted(str(i) for i in (standard_group_ids or [])),
            "rubric": rubric,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetRubricsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchRubricsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        simulation_rubric=simulation_rubric,
        video_rubric=video_rubric,
        standard_group_ids=standard_group_ids or [],
        rubric=rubric,
    )
    result = cast(
        SearchRubricsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRubricsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

"""reasoning_levels/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetReasoningLevelsV4Item,
    SearchReasoningLevelsSqlParams,
    SearchReasoningLevelsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/reasoning_levels/search_reasoning_levels_complete.sql"
)

async def search_reasoning_levels_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    reasoning_level_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    model: bool = False,
) -> list[QGetReasoningLevelsV4Item]:
    """Internal function to search reasoning_levels."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "reasoning_levels"]
    cache_key_val = cache_key(
        "/api/v5/resources/reasoning_levels/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "reasoning_level_ids": sorted(str(i) for i in (reasoning_level_ids or [])),
            "agent": agent,
            "model": model,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetReasoningLevelsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchReasoningLevelsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        reasoning_level_ids=reasoning_level_ids or [],
        agent=agent,
        model=model,
    )
    result = cast(
        SearchReasoningLevelsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetReasoningLevelsV4Item] = (
        result.items if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

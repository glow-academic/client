"""args_outputs/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetArgsOutputsV4Item,
    SearchArgsOutputsSqlParams,
    SearchArgsOutputsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/args_outputs/search_args_outputs_complete.sql"

async def search_args_outputs_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    args_ids: list[UUID] | None = None,
    tool: bool = False,
) -> list[QGetArgsOutputsV4Item]:
    """Internal function to search args_outputs."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "args_outputs"]
    cache_key_val = cache_key(
        "/api/v5/resources/args_outputs/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "args_ids": [str(id) for id in (args_ids or [])],
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetArgsOutputsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchArgsOutputsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        args_ids=args_ids or [],
        tool=tool,
    )
    result = cast(
        SearchArgsOutputsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgsOutputsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

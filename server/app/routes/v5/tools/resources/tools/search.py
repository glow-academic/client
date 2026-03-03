"""tools/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetToolsV4Item,
    SearchToolsSqlParams,
    SearchToolsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/tools/search_tools_complete.sql"

async def search_tools_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    operation: str | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    tool: bool = False,
) -> list[QGetToolsV4Item]:
    """Internal function to search tools."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "tools"]
    cache_key_val = cache_key(
        "/api/v5/resources/tools/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "operation": operation,
            "agent": agent,
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetToolsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = SearchToolsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        operation=operation,
        agent=agent,
        tool=tool,
    )
    result = cast(
        SearchToolsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetToolsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

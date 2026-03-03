"""suite_department/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchSuiteDepartmentEntriesSqlParams,
    SearchSuiteDepartmentEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/suite_department/search_suite_department_entries_complete.sql"

async def search_suite_department_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    suite_id: UUID | None = None,
    departments_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search suite_department entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "suite_department"]
    cache_key_val = cache_key(
        "/api/v5/entries/suite_department/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "suite_id": str(suite_id) if suite_id else None,
            "departments_id": str(departments_id) if departments_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchSuiteDepartmentEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        suite_id=suite_id,
        departments_id=departments_id,
    )
    result = cast(
        SearchSuiteDepartmentEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items

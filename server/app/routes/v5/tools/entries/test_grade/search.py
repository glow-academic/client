"""test_grade/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchTestGradeEntriesSqlParams,
    SearchTestGradeEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/entries/test_grade/search_test_grade_entries_complete.sql"
)

async def search_test_grade_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    invocation_id: UUID | None = None,
    run_id: UUID | None = None,
    rubric_grade_agent_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search test_grade entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "test_grade"]
    cache_key_val = cache_key(
        "/api/v5/entries/test_grade/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "invocation_id": str(invocation_id) if invocation_id else None,
            "run_id": str(run_id) if run_id else None,
            "rubric_grade_agent_id": str(rubric_grade_agent_id)
            if rubric_grade_agent_id
            else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchTestGradeEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        invocation_id=invocation_id,
        run_id=run_id,
        rubric_grade_agent_id=rubric_grade_agent_id,
    )
    result = cast(
        SearchTestGradeEntriesSqlRow,
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

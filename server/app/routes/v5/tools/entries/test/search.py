"""Test search — filtered/paginated query against test_mv."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.test.types import GetTestResponse
from app.sql.types import (
    GetTestListViewSqlParams,
    GetTestListViewSqlRow,
    QGetTestListViewV4Option,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

MV_NAME = "test_mv"

LIST_SQL_PATH = "app/sql/queries/views/test/list/get_test_list_view_complete.sql"


async def search_tests(
    conn: asyncpg.Connection,
    eval_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetTestResponse]:
    """Search test entries from test_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT test_id, eval_id, profile_id, department_ids,
               test_name, test_description,
               num_invocations, infinite_mode, archived, test_created_at
        FROM {source}
        WHERE ($1::uuid[] IS NULL OR eval_id = ANY($1))
          AND ($2::uuid[] IS NULL OR profile_id = ANY($2))
        ORDER BY test_created_at DESC
        LIMIT $3 OFFSET $4
        """,
        eval_ids,
        profile_ids,
        limit,
        offset,
    )

    return [GetTestResponse(**dict(r)) for r in rows]


async def get_test_list_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    eval_ids: list[UUID] | None = None,
    is_archived_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search_text: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetTestListViewSqlRow:
    """Internal function for fetching test list data from test_mv."""
    cache_key_val = cache_key(
        "entries/test/list/get",
        {
            "test_ids": [str(t) for t in test_ids] if test_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "eval_ids": [str(e) for e in eval_ids] if eval_ids else None,
            "is_archived_filter": is_archived_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "search_text": search_text,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetTestListViewSqlRow.model_validate(cached)

    params = GetTestListViewSqlParams(
        test_ids=test_ids,
        department_ids=department_ids,
        eval_ids=eval_ids,
        is_archived_filter=is_archived_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        search_text=search_text,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    # Filter out options with empty values
    eval_options: list[QGetTestListViewV4Option] | None = None
    if result and result.eval_options:
        eval_options = [opt for opt in result.eval_options if opt.value]

    response = GetTestListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
        eval_options=eval_options,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "test", "list"],
        redis=get_redis_client(),
    )

    return response

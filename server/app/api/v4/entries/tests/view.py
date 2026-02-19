"""View wrapper for benchmark tests entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/benchmark/tests/get_test_view_complete.sql"


class BenchmarkTestViewItem(BaseModel):
    """Single benchmark test row from test_mv."""

    test_id: UUID
    eval_id: UUID | None = None
    profile_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)
    infinite_mode: bool = False
    archived: bool = False
    created_at: datetime | None = None


class GetBenchmarkTestsResponse(BaseModel):
    """Response for benchmark tests view."""

    items: list[BenchmarkTestViewItem] = Field(default_factory=list)
    total_count: int = 0


async def get_test_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    eval_id: UUID | None = None,
    eval_ids: list[UUID] | None = None,
    profile_id: UUID | None = None,
    archived: bool | None = None,
    department_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetBenchmarkTestsResponse:
    """Internal function for reading benchmark tests rows."""
    from app.sql.types import GetBenchmarkTestsViewSqlParams

    normalized_test_ids = test_ids or []
    cache_key_val = cache_key(
        "views/benchmark/tests/get",
        {
            "test_ids": [str(t) for t in normalized_test_ids],
            "eval_id": str(eval_id) if eval_id else None,
            "eval_ids": [str(e) for e in eval_ids] if eval_ids else None,
            "profile_id": str(profile_id) if profile_id else None,
            "archived": archived,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetBenchmarkTestsResponse.model_validate(cached)

    params = GetBenchmarkTestsViewSqlParams(
        test_ids=normalized_test_ids or None,
        eval_id_filter=eval_id,
        eval_ids_filter=eval_ids,
        profile_id_filter=profile_id,
        archived_filter=archived,
        department_ids_filter=department_ids,
        date_from_filter=date_from,
        date_to_filter=date_to,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[BenchmarkTestViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                BenchmarkTestViewItem(
                    test_id=item.test_id,
                    eval_id=item.eval_id,
                    profile_id=item.profile_id,
                    department_ids=list(item.department_ids)
                    if item.department_ids
                    else [],
                    infinite_mode=item.infinite_mode or False,
                    archived=item.archived or False,
                    created_at=item.created_at,
                )
            )

    total_count = result.total_count if result else 0

    response = GetBenchmarkTestsResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "tests"],
    )

    return response

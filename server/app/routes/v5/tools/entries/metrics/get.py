"""metrics/get internal — reusable data-access layer."""

import json
from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.globals import get_redis_client
from app.sql.types import (
    GetMetricListViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

VIEW_SQL_PATH = "app/sql/queries/views/metric/list/get_metric_list_view_complete.sql"


async def get_metric_list_view_internal(
    conn: asyncpg.Connection,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMetricListViewSqlRow:
    """Internal function for fetching metrics data from MV."""
    from app.sql.types import GetMetricListViewSqlParams

    cache_key_val = cache_key(
        "views/metric/list/get",
        {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetMetricListViewSqlRow.model_validate(cached)

    params = GetMetricListViewSqlParams(
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetMetricListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "metric", "list"],
        redis=get_redis_client(),
    )

    return response


async def get_metrics_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch metrics entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "metrics"]
    cache_key_val = cache_key(
        "/api/v5/entries/metrics/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    result = await conn.fetchval(
        """
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date_hour', m.date_hour,
            'sample_count', m.sample_count,
            'avg_cpu_percent', m.avg_cpu_percent,
            'min_cpu_percent', m.min_cpu_percent,
            'max_cpu_percent', m.max_cpu_percent,
            'avg_latency_ms', m.avg_latency_ms,
            'min_latency_ms', m.min_latency_ms,
            'max_latency_ms', m.max_latency_ms,
            'avg_memory_bytes', m.avg_memory_bytes,
            'min_memory_bytes', m.min_memory_bytes,
            'max_memory_bytes', m.max_memory_bytes,
            'max_requests_total', m.max_requests_total,
            'max_errors_total', m.max_errors_total
        )), '[]'::jsonb)
        FROM metrics_mv m
        WHERE m.date_hour = ANY($1)
        """,
        ids,
    )

    items: list[dict] = (
        json.loads(result) if isinstance(result, str) else (result or [])
    )

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

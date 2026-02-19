"""View wrapper for metrics list entries."""

from datetime import datetime

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/metric/list/get_metric_list_view_complete.sql"


class MetricViewItem(BaseModel):
    """Single item from the metrics list view."""

    date_hour: datetime
    sample_count: int = 0
    avg_cpu_percent: float | None = None
    min_cpu_percent: float | None = None
    max_cpu_percent: float | None = None
    avg_latency_ms: float | None = None
    min_latency_ms: float | None = None
    max_latency_ms: float | None = None
    avg_memory_bytes: int | None = None
    min_memory_bytes: int | None = None
    max_memory_bytes: int | None = None
    max_requests_total: int | None = None
    max_errors_total: int | None = None


class GetMetricListViewResponse(BaseModel):
    """Response containing metrics list data."""

    items: list[MetricViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_metric_list_view_internal(
    conn: asyncpg.Connection,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMetricListViewResponse:
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
        cached = await get_cached(cache_key_val)
        if cached:
            return GetMetricListViewResponse.model_validate(cached)

    params = GetMetricListViewSqlParams(
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[MetricViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MetricViewItem(
                    date_hour=item.date_hour,
                    sample_count=item.sample_count or 0,
                    avg_cpu_percent=item.avg_cpu_percent,
                    min_cpu_percent=item.min_cpu_percent,
                    max_cpu_percent=item.max_cpu_percent,
                    avg_latency_ms=item.avg_latency_ms,
                    min_latency_ms=item.min_latency_ms,
                    max_latency_ms=item.max_latency_ms,
                    avg_memory_bytes=item.avg_memory_bytes,
                    min_memory_bytes=item.min_memory_bytes,
                    max_memory_bytes=item.max_memory_bytes,
                    max_requests_total=item.max_requests_total,
                    max_errors_total=item.max_errors_total,
                )
            )

    response = GetMetricListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "metric", "list"],
    )

    return response

"""View wrapper for health list entries."""

from datetime import datetime

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/health/list/get_health_list_view_complete.sql"


class HealthViewItem(BaseModel):
    """Single item from the health list view."""

    date_hour: datetime
    service: str | None = None
    check_count: int = 0
    ok_count: int = 0
    fail_count: int = 0
    uptime_percent: float | None = None
    avg_latency_ms: float | None = None
    min_latency_ms: float | None = None
    max_latency_ms: float | None = None
    latest_ok: bool | None = None
    latest_error: str | None = None


class GetHealthListViewResponse(BaseModel):
    """Response containing health list data."""

    items: list[HealthViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_health_list_view_internal(
    conn: asyncpg.Connection,
    service_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetHealthListViewResponse:
    """Internal function for fetching health data from MV."""
    from app.sql.types import GetHealthListViewSqlParams

    cache_key_val = cache_key(
        "views/health/list/get",
        {
            "service_filter": service_filter,
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
            return GetHealthListViewResponse.model_validate(cached)

    params = GetHealthListViewSqlParams(
        service_filter=service_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[HealthViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                HealthViewItem(
                    date_hour=item.date_hour,
                    service=item.service,
                    check_count=item.check_count or 0,
                    ok_count=item.ok_count or 0,
                    fail_count=item.fail_count or 0,
                    uptime_percent=item.uptime_percent,
                    avg_latency_ms=item.avg_latency_ms,
                    min_latency_ms=item.min_latency_ms,
                    max_latency_ms=item.max_latency_ms,
                    latest_ok=item.latest_ok,
                    latest_error=item.latest_error,
                )
            )

    response = GetHealthListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "health", "list"],
    )

    return response

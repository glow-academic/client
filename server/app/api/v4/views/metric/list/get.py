"""Get endpoint for metric list view."""

from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.metric.list.types import (
    GetMetricListViewResponse,
    MetricViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/metric/list/get_metric_list_view_complete.sql"

router = APIRouter()


async def get_metric_list_view_internal(
    conn: asyncpg.Connection,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMetricListViewResponse:
    """Internal function for fetching metric data from mv_metrics."""
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


@router.post(
    "/get",
    response_model=GetMetricListViewResponse,
    dependencies=[
        audit_activity(
            "views.metric.list.get",
            "{{ actor.name }} fetched metric list data",
        )
    ],
)
async def get_metrics(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMetricListViewResponse:
    """Get metric data from the materialized view."""
    tags = ["views", "metric", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_metric_list_view_internal(
            conn=conn,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_metric_list_get",
            request=http_request,
        )

"""Get endpoint for health metrics hourly view (mv_health_metrics_hourly)."""

from datetime import datetime
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.health.metrics_hourly.types import (
    GetHealthMetricsHourlyRequest,
    GetHealthMetricsHourlyResponse,
    HealthMetricsHourlyItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_health_metrics_hourly_internal(
    conn: asyncpg.Connection,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page_limit: int = 168,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetHealthMetricsHourlyResponse:
    """Internal function for fetching health metrics hourly data."""
    cache_key_val = cache_key(
        "views/health/metrics_hourly/get",
        {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHealthMetricsHourlyResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if date_from:
        conditions.append(f"date_hour >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"date_hour < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    count_query = f"SELECT COUNT(*) FROM mv_health_metrics_hourly WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_health_metrics_hourly
        WHERE {where_clause}
        ORDER BY date_hour DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        HealthMetricsHourlyItem(
            date_hour=row["date_hour"],
            sample_count=row["sample_count"] or 0,
            avg_cpu_percent=float(row["avg_cpu_percent"])
            if row["avg_cpu_percent"]
            else 0.0,
            min_cpu_percent=float(row["min_cpu_percent"])
            if row["min_cpu_percent"]
            else 0.0,
            max_cpu_percent=float(row["max_cpu_percent"])
            if row["max_cpu_percent"]
            else 0.0,
            avg_latency_ms=float(row["avg_latency_ms"])
            if row["avg_latency_ms"]
            else 0.0,
            min_latency_ms=float(row["min_latency_ms"])
            if row["min_latency_ms"]
            else 0.0,
            max_latency_ms=float(row["max_latency_ms"])
            if row["max_latency_ms"]
            else 0.0,
            avg_memory_bytes=row["avg_memory_bytes"] or 0,
            min_memory_bytes=row["min_memory_bytes"] or 0,
            max_memory_bytes=row["max_memory_bytes"] or 0,
            max_requests_total=row["max_requests_total"] or 0,
            max_errors_total=row["max_errors_total"] or 0,
        )
        for row in rows
    ]

    response = GetHealthMetricsHourlyResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "health", "metrics_hourly"],
    )

    return response


@router.post(
    "/get",
    response_model=GetHealthMetricsHourlyResponse,
    dependencies=[
        audit_activity(
            "views.health.metrics_hourly.get",
            "{{ actor.name }} fetched health metrics hourly data",
        )
    ],
)
async def get_health_metrics_hourly(
    request: GetHealthMetricsHourlyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHealthMetricsHourlyResponse:
    """Get health metrics hourly data from mv_health_metrics_hourly."""
    tags = ["views", "health", "metrics_hourly"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_health_metrics_hourly_internal(
            conn=conn,
            date_from=request.date_from,
            date_to=request.date_to,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
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
            operation="views_health_metrics_hourly_get",
            request=http_request,
        )

"""Health analytics bundle endpoint - POST /analytics/health/get."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.health.types import (
    GetHealthAnalyticsRequest,
    GetHealthAnalyticsResponse,
    HealthKpiItem,
    HealthKpis,
    HealthMetricsItem,
    HealthTrendItem,
)
from app.api.v4.views.health.metrics_hourly.get import (
    get_health_metrics_hourly_internal,
)
from app.api.v4.views.health.service_hourly.get import (
    get_health_service_hourly_internal,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


def _build_kpi(
    service_items: list,
    service: str,
) -> HealthKpiItem | None:
    if not service_items:
        return None

    sorted_items = sorted(
        [i for i in service_items if i.service == service],
        key=lambda x: x.date_hour,
    )
    if not sorted_items:
        return None

    latest = sorted_items[-1]
    trend = [
        HealthTrendItem(
            date=i.date_hour.isoformat(),
            value=float(i.uptime_percent or 0),
            latency=float(i.avg_latency_ms or 0),
            count=int(i.check_count or 0),
        )
        for i in sorted_items
    ]
    return HealthKpiItem(
        ok=bool(latest.latest_ok) if latest.latest_ok is not None else False,
        latency_ms=float(latest.avg_latency_ms or 0),
        error=latest.latest_error,
        trend=trend,
    )


async def get_health_analytics_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> GetHealthAnalyticsResponse:
    cache_key_val = cache_key("analytics/health/get", {})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHealthAnalyticsResponse.model_validate(cached)

    actor_name: str | None = None
    if profile_id:
        actor_name = await conn.fetchval(
            """
            SELECT n.name
            FROM profile_names_junction pn
            JOIN names_resource n ON n.id = pn.name_id
            WHERE pn.profile_id = $1
            LIMIT 1
            """,
            profile_id,
        )

    now = datetime.now(timezone.utc)
    date_from = now - timedelta(days=7)

    service_hourly = await get_health_service_hourly_internal(
        conn=conn,
        service=None,
        date_from=date_from,
        date_to=now,
        page_limit=168,
        page_offset=0,
        bypass_cache=bypass_cache,
    )
    metrics_hourly = await get_health_metrics_hourly_internal(
        conn=conn,
        date_from=date_from,
        date_to=now,
        page_limit=168,
        page_offset=0,
        bypass_cache=bypass_cache,
    )

    items = service_hourly.items
    health_kpis = HealthKpis(
        websocket=_build_kpi(items, "websocket"),
        redis=_build_kpi(items, "redis"),
        document=_build_kpi(items, "tus"),
        database=_build_kpi(items, "database"),
        authentication=_build_kpi(items, "keycloak"),
    )

    metrics_sorted = sorted(metrics_hourly.items, key=lambda x: x.date_hour)
    metrics = [
        HealthMetricsItem(
            date=item.date_hour.isoformat(),
            cpu_percent=float(item.avg_cpu_percent or 0),
            latency_ms=float(item.avg_latency_ms or 0),
            memory_bytes=int(item.avg_memory_bytes or 0),
            requests_total=int(item.max_requests_total or 0),
            errors_total=int(item.max_errors_total or 0),
            sample_count=int(item.sample_count or 0),
        )
        for item in metrics_sorted
    ]

    response = GetHealthAnalyticsResponse(
        actor_name=actor_name or "System",
        health_kpis=health_kpis,
        metrics=metrics,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["analytics", "health"],
    )

    return response


@router.post(
    "/get",
    response_model=GetHealthAnalyticsResponse,
    dependencies=[audit_activity("analytics.health.get", "{{ actor.name }} viewed health")],
)
async def get_health_analytics(
    request: GetHealthAnalyticsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHealthAnalyticsResponse:
    """Get health analytics bundle."""
    tags = ["analytics", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id_val = http_request.state.profile_id
        profile_id = UUID(profile_id_val) if profile_id_val else None

        result = await get_health_analytics_internal(
            conn=conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="analytics_health_get",
            request=http_request,
        )

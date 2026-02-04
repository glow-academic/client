"""Get endpoint for analytics daily metrics view (mv_daily_metrics)."""

from datetime import date
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v4.views.analytics.daily_metrics.types import (
    DailyMetricsItem,
    GetDailyMetricsRequest,
    GetDailyMetricsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/daily_metrics/get_analytics_daily_metrics_view_complete.sql"

router = APIRouter()


class GetAnalyticsDailyMetricsSqlParams(BaseModel):
    """Typed SQL params for api_get_analytics_daily_metrics_view_v4."""

    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    attempt_type_filter: str | None = None
    is_archived_filter: bool = False
    date_from: date | None = None
    date_to: date | None = None
    sort_by: str = "date"
    sort_order: str = "asc"
    page_limit: int = 365
    page_offset: int = 0

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.cohort_ids,
            self.simulation_ids,
            self.attempt_type_filter,
            self.is_archived_filter,
            self.date_from,
            self.date_to,
            self.sort_by,
            self.sort_order,
            self.page_limit,
            self.page_offset,
        )


async def get_daily_metrics_internal(
    conn: asyncpg.Connection,
    request: GetDailyMetricsRequest,
    bypass_cache: bool = False,
) -> GetDailyMetricsResponse:
    """Internal function for fetching daily metrics from mv_daily_metrics."""
    cache_key_val = cache_key(
        "views/analytics/daily-metrics/get",
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetDailyMetricsResponse.model_validate(cached)

    params = GetAnalyticsDailyMetricsSqlParams(
        cohort_ids=request.cohort_ids,
        simulation_ids=request.simulation_ids,
        attempt_type_filter=request.attempt_type,
        is_archived_filter=request.is_archived,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[DailyMetricsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                DailyMetricsItem(
                    date_key=item.date_key,
                    cohort_id=item.cohort_id,
                    simulation_id=item.simulation_id,
                    attempt_type=item.attempt_type or "general",
                    is_archived=item.is_archived or False,
                    attempt_count=item.attempt_count or 0,
                    unique_profiles=item.unique_profiles or 0,
                    completed_count=item.completed_count or 0,
                    passed_count=item.passed_count or 0,
                    avg_score=float(item.avg_score)
                    if item.avg_score is not None
                    else None,
                    total_time_seconds=item.total_time_seconds or 0,
                    avg_messages=float(item.avg_messages)
                    if item.avg_messages is not None
                    else None,
                )
            )

    response = GetDailyMetricsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "analytics", "daily_metrics"],
    )

    return response


@router.post(
    "/get",
    response_model=GetDailyMetricsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.daily_metrics.get",
            "{{ actor.name }} fetched analytics daily metrics data",
        )
    ],
)
async def get_daily_metrics(
    request: GetDailyMetricsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDailyMetricsResponse:
    """Get daily metrics data from mv_daily_metrics with filter/search only (no joins)."""
    tags = ["views", "analytics", "daily_metrics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_daily_metrics_internal(
            conn=conn,
            request=request,
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
            operation="views_analytics_daily_metrics_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

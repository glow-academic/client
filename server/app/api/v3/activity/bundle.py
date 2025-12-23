"""Activity bundle endpoint for header metrics."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.dashboard.bundle import Method, MetricResponse, TrendData
from app.main import get_db
from app.infra.activity.audit import audit_activity
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ActivityBundleFilters(BaseModel):
    """Filters for activity bundle request."""

    pass
    # No filters needed for header metrics


class ActivityChartDataPoint(BaseModel):
    """Activity chart data point."""

    date: str
    activeProfiles: int
    feedbackEntries: int
    activityEntries: int
    errors: int


class ActivityBundleMetrics(BaseModel):
    """Header metrics for activity page."""

    active_profiles_count: MetricResponse
    total_feedback_count: MetricResponse
    total_activity_entries: MetricResponse
    total_errors_count: MetricResponse


class ActivityBundleResponse(BaseModel):
    """Response for activity bundle endpoint."""

    metrics: ActivityBundleMetrics
    chartData: list[ActivityChartDataPoint]


router = APIRouter()


def compute_status(
    value: int, threshold_warning: int = 0, threshold_danger: int = 0
) -> str:
    """Compute status based on value and thresholds."""
    if value >= threshold_warning:
        return "success"
    elif value >= threshold_danger:
        return "warning"
    else:
        return "neutral"


@router.post(
    "/bundle",
    response_model=ActivityBundleResponse,
    dependencies=[
        audit_activity("activity.bundle", "{{ actor.name }} viewed activity metrics")
    ],
)
async def get_activity_bundle(
    filters: ActivityBundleFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ActivityBundleResponse:
    """Get activity bundle with header metrics."""
    tags = ["activity"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ActivityBundleResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql("sql/v3/activity/bundle.sql")
        sql_params = ()

        # Execute query
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to fetch activity metrics"
            )

        # Extract header metrics
        active_profiles = result["active_profiles_count"] or 0
        total_feedback = result["total_feedback_count"] or 0
        total_activity = result["total_activity_entries"] or 0
        total_errors = result["total_errors_count"] or 0

        # Parse chart data
        chart_data_raw = result.get("chart_data")
        chart_data: list[ActivityChartDataPoint] = []
        if chart_data_raw:
            if isinstance(chart_data_raw, str):
                chart_data_json = json.loads(chart_data_raw)
            else:
                chart_data_json = chart_data_raw

            if isinstance(chart_data_json, list):
                chart_data = [
                    ActivityChartDataPoint(**item) for item in chart_data_json
                ]

        # Calculate trend data for each metric (last 30 days for modal charts)
        def calculate_trend_data(metric_key: str) -> list[TrendData]:
            """Calculate trend data for a metric from chart data."""
            if not chart_data:
                return []

            # Get last 30 days of data
            recent_data = chart_data[-30:] if len(chart_data) > 30 else chart_data

            trend_data = []
            for point in recent_data:
                value = getattr(point, metric_key, 0)
                trend_data.append(
                    TrendData(
                        date=point.date,
                        value=float(value),
                        count=1,
                    )
                )
            return trend_data

        # Build metrics with trend data
        metrics = ActivityBundleMetrics(
            active_profiles_count=MetricResponse(
                hasData=active_profiles > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=active_profiles,
                status=compute_status(active_profiles),
                trendAnalysis=None,
                trendData=calculate_trend_data("activeProfiles"),
                dataPoints=[],
            ),
            total_feedback_count=MetricResponse(
                hasData=total_feedback > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=total_feedback,
                status=compute_status(total_feedback),
                trendAnalysis=None,
                trendData=calculate_trend_data("feedbackEntries"),
                dataPoints=[],
            ),
            total_activity_entries=MetricResponse(
                hasData=total_activity > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=total_activity,
                status=compute_status(total_activity),
                trendAnalysis=None,
                trendData=calculate_trend_data("activityEntries"),
                dataPoints=[],
            ),
            total_errors_count=MetricResponse(
                hasData=total_errors > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=total_errors,
                status=compute_status(
                    total_errors, threshold_warning=10, threshold_danger=50
                ),
                trendAnalysis=None,
                trendData=calculate_trend_data("errors"),
                dataPoints=[],
            ),
        )

        result_data = ActivityBundleResponse(metrics=metrics, chartData=chart_data)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": result_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_activity_bundle",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

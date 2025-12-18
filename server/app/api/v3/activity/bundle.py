"""Activity bundle endpoint for header metrics."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.dashboard.bundle import DataPoint, Method, MetricResponse, TrendData
from app.main import get_db
from app.utils.activity.audit import audit_activity
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ActivityBundleFilters(BaseModel):
    """Filters for activity bundle request."""

    pass
    # No filters needed for header metrics


class ActivityBundleMetrics(BaseModel):
    """Header metrics for activity page."""

    total_activity_entries: MetricResponse
    recent_activity_24h: MetricResponse
    unresolved_feedback_count: MetricResponse
    total_feedback_count: MetricResponse


class ActivityBundleResponse(BaseModel):
    """Response for activity bundle endpoint."""

    metrics: ActivityBundleMetrics


router = APIRouter()


def compute_status(value: int, threshold_warning: int = 0, threshold_danger: int = 0) -> str:
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
            raise HTTPException(status_code=500, detail="Failed to fetch activity metrics")

        total_activity = result["total_activity_entries"] or 0
        recent_24h = result["recent_activity_24h"] or 0
        unresolved_feedback = result["unresolved_feedback_count"] or 0
        total_feedback = result["total_feedback_count"] or 0

        # Calculate growth rate (7d vs 30d)
        recent_7d = result["recent_activity_7d"] or 0
        recent_30d = result["recent_activity_30d"] or 0
        growth_rate = 0.0
        if recent_30d > 0:
            growth_rate = ((recent_7d - (recent_30d - recent_7d)) / recent_30d) * 100

        # Build metrics with all required fields
        metrics = ActivityBundleMetrics(
            total_activity_entries=MetricResponse(
                hasData=total_activity > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=total_activity,
                status=compute_status(total_activity),
                trendAnalysis=None,
                trendData=[],
                dataPoints=[],
            ),
            recent_activity_24h=MetricResponse(
                hasData=recent_24h > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=recent_24h,
                status=compute_status(recent_24h),
                trendAnalysis=None,
                trendData=[],
                dataPoints=[],
            ),
            unresolved_feedback_count=MetricResponse(
                hasData=unresolved_feedback > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=unresolved_feedback,
                status=compute_status(unresolved_feedback, threshold_warning=5, threshold_danger=10),
                trendAnalysis=None,
                trendData=[],
                dataPoints=[],
            ),
            total_feedback_count=MetricResponse(
                hasData=total_feedback > 0,
                method=Method.COUNT_DISTINCT,
                currentValue=total_feedback,
                status=compute_status(total_feedback),
                trendAnalysis=None,
                trendData=[],
                dataPoints=[],
            ),
        )

        result_data = ActivityBundleResponse(metrics=metrics)

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


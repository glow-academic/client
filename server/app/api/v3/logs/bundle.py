"""Logs bundle endpoint - POST /logs/bundle"""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


# Inline request/response schemas
class LogsBundleRequest(BaseModel):
    """Logs bundle request schema."""

    profileId: str


class TrendData(BaseModel):
    """Trend data point for health KPIs."""

    date: str
    value: float
    latency: float
    count: int


class HealthKPI(BaseModel):
    """Health KPI data for a service."""

    ok: bool
    latency_ms: float
    error: str
    trend: list[TrendData]


class HealthKPIs(BaseModel):
    """All health KPIs."""

    websocket: HealthKPI
    redis: HealthKPI
    document: HealthKPI
    database: HealthKPI
    authentication: HealthKPI


class MetricsDataPoint(BaseModel):
    """App metrics data point."""

    date: str
    cpu_percent: float
    latency_ms: float
    memory_bytes: float
    requests_total: int
    errors_total: int
    sample_count: int


class LogsBundleResponse(BaseModel):
    """Logs bundle response."""

    health_kpis: HealthKPIs
    metrics: list[MetricsDataPoint]


def _parse_json_strings_recursive(obj: Any) -> Any:
    """Recursively parse JSON strings in nested structures."""
    if isinstance(obj, str):
        try:
            return json.loads(obj)
        except (json.JSONDecodeError, ValueError):
            return obj
    elif isinstance(obj, dict):
        return {k: _parse_json_strings_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_parse_json_strings_recursive(item) for item in obj]
    else:
        return obj


@router.post("/bundle", response_model=LogsBundleResponse)
async def get_logs_bundle(
    request: LogsBundleRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsBundleResponse:
    """Get logs bundle with health KPIs and metrics."""
    tags = ["logs"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return LogsBundleResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/logs/bundle.sql")
        sql_params = ()  # No parameters for this query

        # Execute query
        result = await conn.fetchval(sql_query)

        # Handle empty results gracefully
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Parse health KPIs
        health_kpis_data = parsed_result.get("health_kpis", {})

        def parse_health_kpi(kpi_data: dict[str, Any]) -> HealthKPI:
            """Parse a single health KPI with proper trend data."""
            trend_data = kpi_data.get("trend", [])
            if isinstance(trend_data, str):
                trend_data = json.loads(trend_data)
            if not isinstance(trend_data, list):
                trend_data = []
            trend = [TrendData(**item) for item in trend_data if isinstance(item, dict)]

            return HealthKPI(
                ok=kpi_data.get("ok", False),
                latency_ms=kpi_data.get("latency_ms", 0.0),
                error=kpi_data.get("error", ""),
                trend=trend,
            )

        health_kpis = HealthKPIs(
            websocket=parse_health_kpi(health_kpis_data.get("websocket", {})),
            redis=parse_health_kpi(health_kpis_data.get("redis", {})),
            document=parse_health_kpi(health_kpis_data.get("document", {})),
            database=parse_health_kpi(health_kpis_data.get("database", {})),
            authentication=parse_health_kpi(health_kpis_data.get("authentication", {})),
        )

        # Parse metrics
        metrics_data = parsed_result.get("metrics", [])
        if isinstance(metrics_data, str):
            metrics_data = json.loads(metrics_data)
        metrics = [
            MetricsDataPoint(**item)
            for item in (metrics_data if isinstance(metrics_data, list) else [])
        ]

        # Build response
        response_data = LogsBundleResponse(
            health_kpis=health_kpis,
            metrics=metrics,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,  # Cache for 1 minute (health data changes frequently)
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_logs_bundle",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

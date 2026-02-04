"""Get endpoint for health artifact."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.health.types import (
    HealthRequest,
    HealthResponse,
    HealthViews,
)
from app.api.v4.views.health.service_hourly.get import get_health_service_hourly_internal
from app.api.v4.views.health.metrics_hourly.get import get_health_metrics_hourly_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=HealthResponse,
    dependencies=[
        audit_activity(
            "artifacts.health.get",
            "{{ actor.name }} fetched health artifact data",
        )
    ],
)
async def get_health(
    request: HealthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HealthResponse:
    """Get health artifact data."""
    tags = ["artifacts", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        async def fetch_service_hourly():
            async with pool.acquire() as c:
                return await get_health_service_hourly_internal(
                    conn=c,
                    service=request.service,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_metrics_hourly():
            async with pool.acquire() as c:
                return await get_health_metrics_hourly_internal(
                    conn=c,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        service_hourly_result, metrics_hourly_result = await asyncio.gather(
            fetch_service_hourly(),
            fetch_metrics_hourly(),
        )

        views = HealthViews(
            service_hourly=service_hourly_result.items,
            metrics_hourly=metrics_hourly_result.items,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return HealthResponse(
            views=views,
            total_count=service_hourly_result.total_count,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_health_get",
            request=http_request,
        )

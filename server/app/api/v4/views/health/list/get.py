"""Get endpoint for health list view."""

from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.health.list.types import (
    GetHealthListViewResponse,
    HealthViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/health/list/get_health_list_view_complete.sql"

router = APIRouter()


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
    """Internal function for fetching health data from health_mv."""
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


@router.post(
    "/get",
    response_model=GetHealthListViewResponse,
    dependencies=[
        audit_activity(
            "views.health.list.get",
            "{{ actor.name }} fetched health list data",
        )
    ],
)
async def get_health(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHealthListViewResponse:
    """Get health data from the materialized view."""
    tags = ["views", "health", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_health_list_view_internal(
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
            operation="views_health_list_get",
            request=http_request,
        )

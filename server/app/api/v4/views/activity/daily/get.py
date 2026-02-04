"""Get endpoint for activity daily view (mv_activity_daily)."""

from datetime import date
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.daily.types import (
    ActivityDailyItem,
    GetActivityDailyRequest,
    GetActivityDailyResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_activity_daily_internal(
    conn: asyncpg.Connection,
    event_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page_limit: int = 30,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityDailyResponse:
    """Internal function for fetching activity daily data."""
    cache_key_val = cache_key(
        "views/activity/daily/get",
        {
            "event_type": event_type,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetActivityDailyResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if event_type:
        conditions.append(f"event_type LIKE ${param_idx}")
        params.append(f"%{event_type}%")
        param_idx += 1

    if date_from:
        conditions.append(f"date_key >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"date_key <= ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    count_query = f"SELECT COUNT(*) FROM mv_activity_daily WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_activity_daily
        WHERE {where_clause}
        ORDER BY date_key DESC, event_count DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        ActivityDailyItem(
            date_key=row["date_key"],
            event_type=row["event_type"],
            event_count=row["event_count"] or 0,
            unique_profiles=row["unique_profiles"] or 0,
            saved_count=row["saved_count"] or 0,
            created_count=row["created_count"] or 0,
            duplicated_count=row["duplicated_count"] or 0,
            uploaded_count=row["uploaded_count"] or 0,
            deleted_count=row["deleted_count"] or 0,
            updated_count=row["updated_count"] or 0,
        )
        for row in rows
    ]

    response = GetActivityDailyResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "daily"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivityDailyResponse,
    dependencies=[
        audit_activity(
            "views.activity.daily.get",
            "{{ actor.name }} fetched activity daily data",
        )
    ],
)
async def get_activity_daily(
    request: GetActivityDailyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityDailyResponse:
    """Get activity daily data from mv_activity_daily."""
    tags = ["views", "activity", "daily"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_daily_internal(
            conn=conn,
            event_type=request.event_type,
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
            operation="views_activity_daily_get",
            request=http_request,
        )

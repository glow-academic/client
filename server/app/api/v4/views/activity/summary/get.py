"""Get endpoint for activity summary view (mv_activity_summary)."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.summary.types import (
    ActivitySummaryItem,
    GetActivitySummaryResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_activity_summary_internal(
    conn: asyncpg.Connection,
    bypass_cache: bool = False,
) -> GetActivitySummaryResponse:
    """Internal function for fetching activity summary data."""
    cache_key_val = cache_key("views/activity/summary/get", {})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetActivitySummaryResponse.model_validate(cached)

    row = await conn.fetchrow("SELECT * FROM mv_activity_summary LIMIT 1")

    summary = None
    if row:
        summary = ActivitySummaryItem(
            total_sessions=row["total_sessions"] or 0,
            active_sessions=row["active_sessions"] or 0,
            total_active_profiles=row["total_active_profiles"] or 0,
            total_logins=row["total_logins"] or 0,
            total_content_created=row["total_content_created"] or 0,
            total_problems=row["total_problems"] or 0,
            unresolved_problems=row["unresolved_problems"] or 0,
            sessions_last_24h=row["sessions_last_24h"] or 0,
            logins_last_24h=row["logins_last_24h"] or 0,
            events_last_24h=row["events_last_24h"] or 0,
            sessions_last_7d=row["sessions_last_7d"] or 0,
            logins_last_7d=row["logins_last_7d"] or 0,
            active_profiles_last_7d=row["active_profiles_last_7d"] or 0,
            refreshed_at=row["refreshed_at"],
        )

    response = GetActivitySummaryResponse(summary=summary)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "summary"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivitySummaryResponse,
    dependencies=[
        audit_activity(
            "views.activity.summary.get",
            "{{ actor.name }} fetched activity summary data",
        )
    ],
)
async def get_activity_summary(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivitySummaryResponse:
    """Get activity summary data from mv_activity_summary."""
    tags = ["views", "activity", "summary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_summary_internal(
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
            operation="views_activity_summary_get",
            request=http_request,
        )

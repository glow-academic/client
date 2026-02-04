"""Get endpoint for activity artifact."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.activity.types import (
    ActivityRequest,
    ActivityResources,
    ActivityResponse,
    ActivityViews,
)
from app.api.v4.views.activity.audits.get import get_activity_audits_internal
from app.api.v4.views.activity.audits.types import GetActivityAuditsResponse
from app.api.v4.views.activity.daily.get import get_activity_daily_internal
from app.api.v4.views.activity.daily.types import GetActivityDailyResponse
from app.api.v4.views.activity.feedbacks.get import get_activity_feedbacks_internal
from app.api.v4.views.activity.feedbacks.types import GetActivityFeedbacksResponse
from app.api.v4.views.activity.logins.get import get_activity_logins_internal
from app.api.v4.views.activity.logins.types import GetActivityLoginsResponse
from app.api.v4.views.activity.session_facts.get import (
    get_activity_session_facts_internal,
)
from app.api.v4.views.activity.session_facts.types import (
    GetActivitySessionFactsResponse,
)
from app.api.v4.views.activity.summary.get import get_activity_summary_internal
from app.api.v4.views.activity.summary.types import GetActivitySummaryResponse
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=ActivityResponse,
    dependencies=[
        audit_activity(
            "artifacts.activity.get",
            "{{ actor.name }} fetched activity artifact data",
        )
    ],
)
async def get_activity(
    request: ActivityRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ActivityResponse:
    """Get activity artifact data."""
    tags = ["artifacts", "activity"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:

        async def fetch_session_facts() -> GetActivitySessionFactsResponse:
            async with pool.acquire() as c:
                return await get_activity_session_facts_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_daily() -> GetActivityDailyResponse:
            async with pool.acquire() as c:
                return await get_activity_daily_internal(
                    conn=c,
                    date_from=request.date_from.date() if request.date_from else None,
                    date_to=request.date_to.date() if request.date_to else None,
                    page_limit=30,
                    bypass_cache=bypass_cache,
                )

        async def fetch_summary() -> GetActivitySummaryResponse:
            async with pool.acquire() as c:
                return await get_activity_summary_internal(
                    conn=c,
                    bypass_cache=bypass_cache,
                )

        async def fetch_logins() -> GetActivityLoginsResponse:
            async with pool.acquire() as c:
                return await get_activity_logins_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_audits() -> GetActivityAuditsResponse:
            async with pool.acquire() as c:
                return await get_activity_audits_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_feedbacks() -> GetActivityFeedbacksResponse:
            async with pool.acquire() as c:
                return await get_activity_feedbacks_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        (
            session_facts_result,
            daily_result,
            summary_result,
            logins_result,
            audits_result,
            feedbacks_result,
        ) = await asyncio.gather(
            fetch_session_facts(),
            fetch_daily(),
            fetch_summary(),
            fetch_logins(),
            fetch_audits(),
            fetch_feedbacks(),
        )

        profile_ids: set[str] = set()
        for item in session_facts_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        for item in logins_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        for item in audits_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        for item in feedbacks_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))

        views = ActivityViews(
            session_facts=session_facts_result.items,
            daily=daily_result.items,
            summary=summary_result.summary,
            logins=logins_result.items,
            audits=audits_result.items,
            feedbacks=feedbacks_result.items,
        )
        resources = ActivityResources(
            profiles={pid: {} for pid in profile_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return ActivityResponse(
            views=views,
            resources=resources,
            total_count=session_facts_result.total_count,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_activity_get",
            request=http_request,
        )

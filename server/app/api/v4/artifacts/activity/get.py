"""Get endpoint for activity artifact."""

import asyncio
from collections import defaultdict
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.activity.types import (
    ActivityAvailableEvent,
    ActivityChartPoint,
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
from app.api.v4.views.activity.problems.get import get_activity_problems_internal
from app.api.v4.views.activity.problems.types import GetActivityProblemsResponse
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


async def resolve_profile_ids_for_filters(
    conn: asyncpg.Connection,
    department_ids: list[str] | None = None,
    roles: list[str] | None = None,
) -> list[UUID] | None:
    """Resolve department_ids + roles to matching profile_ids."""
    if not department_ids and not roles:
        return None
    conditions: list[str] = []
    params: list = []
    idx = 1
    if department_ids:
        conditions.append(f"p.department_ids && ${idx}::uuid[]")
        params.append([UUID(d) for d in department_ids])
        idx += 1
    if roles:
        conditions.append(f"""EXISTS (
            SELECT 1 FROM profile_roles_junction prj
            JOIN roles_resource r ON prj.role_id = r.id
            WHERE prj.profile_id = p.id AND prj.active = true
              AND r.role = ANY(${idx}::profile_type[])
        )""")
        params.append(roles)
        idx += 1
    where = " AND ".join(conditions)
    rows = await conn.fetch(
        f"SELECT p.id FROM profiles_resource p WHERE {where}", *params
    )
    return [row["id"] for row in rows]


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
        # Pre-resolve department/role filters to profile_ids
        filter_profile_ids: list[UUID] | None = None
        if request.department_ids or request.roles:
            async with pool.acquire() as c:
                filter_profile_ids = await resolve_profile_ids_for_filters(
                    conn=c,
                    department_ids=request.department_ids or None,
                    roles=request.roles or None,
                )

        async def fetch_session_facts() -> GetActivitySessionFactsResponse:
            async with pool.acquire() as c:
                return await get_activity_session_facts_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    profile_ids=filter_profile_ids,
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
                    profile_ids=filter_profile_ids,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_audits() -> GetActivityAuditsResponse:
            async with pool.acquire() as c:
                return await get_activity_audits_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    profile_ids=filter_profile_ids,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_feedbacks() -> GetActivityFeedbacksResponse:
            async with pool.acquire() as c:
                return await get_activity_feedbacks_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    profile_ids=filter_profile_ids,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_problems() -> GetActivityProblemsResponse:
            async with pool.acquire() as c:
                return await get_activity_problems_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    profile_ids=filter_profile_ids,
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
            problems_result,
        ) = await asyncio.gather(
            fetch_session_facts(),
            fetch_daily(),
            fetch_summary(),
            fetch_logins(),
            fetch_audits(),
            fetch_feedbacks(),
            fetch_problems(),
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

        # Compute flat chart_data from daily items
        chart_data = [
            ActivityChartPoint(
                date=str(item.date_key),
                event_id=item.event_type,
                count=item.event_count,
            )
            for item in daily_result.items
        ]

        # Compute available_events by aggregating daily items by event_type
        event_totals: dict[str, int] = defaultdict(int)
        for item in daily_result.items:
            event_totals[item.event_type] += item.event_count
        available_events = sorted(
            [
                ActivityAvailableEvent(
                    id=event_type,
                    name=event_type,
                    total_count=total,
                )
                for event_type, total in event_totals.items()
            ],
            key=lambda e: e.total_count,
            reverse=True,
        )

        # Flatten summary metrics
        summary = summary_result.summary
        sessions_count = summary.total_sessions if summary else 0
        active_profiles_count = summary.total_active_profiles if summary else 0
        logins_count = summary.total_logins if summary else 0
        drafts_count = summary.total_drafts if summary else 0

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return ActivityResponse(
            sessions_count=sessions_count,
            active_profiles_count=active_profiles_count,
            logins_count=logins_count,
            drafts_count=drafts_count,
            chart_data=chart_data,
            available_events=available_events,
            problems=problems_result.items,
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

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
from app.api.v4.views.activity.list.get import get_activity_list_view_internal
from app.api.v4.views.activity.list.types import GetActivityListViewResponse
from app.api.v4.views.audit.list.get import get_audit_list_view_internal
from app.api.v4.views.audit.list.types import GetAuditListViewResponse
from app.api.v4.views.grant.list.get import get_grant_list_view_internal
from app.api.v4.views.grant.list.types import GetGrantListViewResponse
from app.api.v4.views.login.list.get import get_login_list_view_internal
from app.api.v4.views.login.list.types import GetLoginListViewResponse
from app.api.v4.views.problem.list.get import get_problem_list_view_internal
from app.api.v4.views.problem.list.types import GetProblemListViewResponse
from app.api.v4.views.session.list.get import get_session_list_view_internal
from app.api.v4.views.session.list.types import GetSessionListViewResponse
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

        async def fetch_activity() -> GetActivityListViewResponse:
            async with pool.acquire() as c:
                return await get_activity_list_view_internal(
                    conn=c,
                    date_from=request.date_from.date() if request.date_from else None,
                    date_to=request.date_to.date() if request.date_to else None,
                    page_limit=1000,
                    bypass_cache=bypass_cache,
                )

        async def fetch_sessions() -> GetSessionListViewResponse:
            async with pool.acquire() as c:
                return await get_session_list_view_internal(
                    conn=c,
                    profile_id_filter=request.profile_id,
                    profile_ids_filter=filter_profile_ids,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_logins() -> GetLoginListViewResponse:
            async with pool.acquire() as c:
                return await get_login_list_view_internal(
                    conn=c,
                    profile_id_filter=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_audits() -> GetAuditListViewResponse:
            async with pool.acquire() as c:
                return await get_audit_list_view_internal(
                    conn=c,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_problems() -> GetProblemListViewResponse:
            async with pool.acquire() as c:
                return await get_problem_list_view_internal(
                    conn=c,
                    profile_id_filter=request.profile_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    bypass_cache=bypass_cache,
                )

        async def fetch_grants() -> GetGrantListViewResponse:
            async with pool.acquire() as c:
                return await get_grant_list_view_internal(
                    conn=c, bypass_cache=bypass_cache
                )

        (
            activity_result,
            sessions_result,
            logins_result,
            audits_result,
            problems_result,
            grants_result,
        ) = await asyncio.gather(
            fetch_activity(),
            fetch_sessions(),
            fetch_logins(),
            fetch_audits(),
            fetch_problems(),
            fetch_grants(),
        )

        # Build chart_data from activity view (date_key + event_type + event_count)
        chart_data = [
            ActivityChartPoint(
                date=str(item.date_key),
                event_id=item.event_type or "",
                count=item.event_count,
            )
            for item in activity_result.items
        ]

        # Build available_events by aggregating activity items by event_type
        event_totals: dict[str, int] = defaultdict(int)
        for item in activity_result.items:
            if item.event_type:
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

        # Derive header metrics from view total_counts
        sessions_count = sessions_result.total_count
        active_profiles_count = activity_result.total_count
        logins_count = logins_result.total_count

        # Compute emulations count from grants
        emulations_count = sum(
            1 for g in grants_result.items if g.emulation_id is not None
        )

        # Build views container
        views = ActivityViews(
            sessions=sessions_result.items,
            activity=activity_result.items,
            logins=logins_result.items,
            audits=audits_result.items,
            problems=problems_result.items,
            grants=grants_result.items,
        )

        # Collect profile_ids for resources
        profile_ids: set[str] = set()
        for item in sessions_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        for item in logins_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        resources = ActivityResources(
            profiles={pid: {} for pid in profile_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return ActivityResponse(
            sessions_count=sessions_count,
            active_profiles_count=active_profiles_count,
            logins_count=logins_count,
            emulations_count=emulations_count,
            chart_data=chart_data,
            available_events=available_events,
            problems=problems_result.items,
            views=views,
            resources=resources,
            total_count=sessions_result.total_count,
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

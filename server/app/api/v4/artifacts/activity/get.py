"""Get endpoint for activity artifact."""

import asyncio
from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.activity.types import (
    ActivityAvailableEvent,
    ActivityChartPoint,
    ActivityInternalData,
    ActivityRequest,
    ActivityResources,
    ActivityResponse,
    ActivityViews,
    ActivityWebsocketResources,
    ActivityWebsocketViews,
    GetActivityWebsocketResponse,
)
from app.api.v4.artifacts.session.list import get_session_list_internal
from app.api.v4.artifacts.session.types import (
    GetSessionListRequest,
    GetSessionListResponse,
)
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.activity.get import get_activity_list_view_internal
from app.api.v4.entries.audits.get import get_audit_list_view_internal
from app.api.v4.entries.grants.get import get_grant_list_view_internal
from app.api.v4.entries.logins.get import get_login_list_view_internal
from app.api.v4.entries.problems.get import get_problem_list_view_internal
from app.api.v4.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.api.v4.entries.sessions.get import get_session_list_view_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetActivityListViewSqlRow,
    GetAuditListViewSqlRow,
    GetGrantListViewSqlRow,
    GetLoginListViewSqlRow,
    GetProblemListViewSqlRow,
    GetSessionListViewSqlRow,
    QGetProfilesV4Item,
)

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


# Activity resource types used for agent resolution via settings
ACTIVITY_BUNDLE_RESOURCES: set[str] = {
    "activity",
    "insights",
    "debug_info",
}


# =============================================================================
# Internal Layer
# =============================================================================


async def get_activity_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    bypass_cache: bool = False,
    # HTTP-specific view filters (ignored by websocket callers)
    profile_id_filter: UUID | None = None,
    profile_ids_filter: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page_limit: int = 50,
    page_offset: int = 0,
) -> ActivityInternalData:
    """Fetch both domain views and config chain in parallel.

    Returns an ActivityInternalData dataclass consumed by both the HTTP
    endpoint and the websocket wrapper.
    """
    # 1. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, _create_tool_ids, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, ACTIVITY_BUNDLE_RESOURCES
    )

    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    config_model_resource_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_resource_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_resource_ids, bypass_cache
            )

    config_provider_resource_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_resource_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_resource_ids, bypass_cache
            )

    # 2. Parallel fetch: views + config profile + runs today
    async def fetch_activity() -> GetActivityListViewSqlRow:
        async with pool.acquire() as c:
            return await get_activity_list_view_internal(
                conn=c,
                date_from=date_from.date() if date_from else None,
                date_to=date_to.date() if date_to else None,
                page_limit=1000,
                bypass_cache=bypass_cache,
            )

    async def fetch_sessions() -> GetSessionListViewSqlRow:
        async with pool.acquire() as c:
            return await get_session_list_view_internal(
                conn=c,
                profile_id_filter=profile_id_filter,
                profile_ids_filter=profile_ids_filter,
                date_from=date_from,
                date_to=date_to,
                page_limit=page_limit,
                page_offset=page_offset,
                bypass_cache=bypass_cache,
            )

    async def fetch_logins() -> GetLoginListViewSqlRow:
        async with pool.acquire() as c:
            return await get_login_list_view_internal(
                conn=c,
                profile_id_filter=profile_id_filter,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            )

    async def fetch_audits() -> GetAuditListViewSqlRow:
        async with pool.acquire() as c:
            return await get_audit_list_view_internal(
                conn=c,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            )

    async def fetch_problems() -> GetProblemListViewSqlRow:
        async with pool.acquire() as c:
            return await get_problem_list_view_internal(
                conn=c,
                profile_id_filter=profile_id_filter,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            )

    async def fetch_grants() -> GetGrantListViewSqlRow:
        async with pool.acquire() as c:
            return await get_grant_list_view_internal(conn=c, bypass_cache=bypass_cache)

    async def fetch_config_profile() -> list[QGetProfilesV4Item]:
        async with pool.acquire() as c:
            return await get_profiles_internal(c, [profile_id], bypass_cache)

    async def fetch_runs_today() -> GetRunListViewResponse:
        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as c:
            return await get_run_list_entries_internal(
                conn=c,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    (
        activity_result,
        sessions_result,
        logins_result,
        audits_result,
        problems_result,
        grants_result,
        config_profile_result,
        runs_result,
    ) = await asyncio.gather(
        fetch_activity(),
        fetch_sessions(),
        fetch_logins(),
        fetch_audits(),
        fetch_problems(),
        fetch_grants(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    return ActivityInternalData(
        activity_result=activity_result,
        sessions_result=sessions_result,
        logins_result=logins_result,
        audits_result=audits_result,
        problems_result=problems_result,
        grants_result=grants_result,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_profile=config_profile_result,
        runs_today=runs_result,
        resource_agent_ids=agent_ids,
        group_id=None,
    )


async def _fetch_session_history_data(
    pool: asyncpg.Pool,
    profile_id: UUID,
    request: ActivityRequest,
    filter_profile_ids: list[UUID] | None,
    bypass_cache: bool,
) -> GetSessionListResponse:
    """Fetch session list history inline — adapted from session/list.py."""
    session_request = GetSessionListRequest(
        active=request.history_active,
        date_from=request.date_from,
        date_to=request.date_to,
        department_ids=request.department_ids,
        roles=request.roles,
        sort_by=request.history_sort_by,
        sort_order=request.history_sort_order,
        page_limit=request.history_page_size,
        page_offset=request.history_page * request.history_page_size,
    )
    async with pool.acquire() as conn:
        return await get_session_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=session_request,
            profile_ids=filter_profile_ids,
            bypass_cache=bypass_cache,
        )


# =============================================================================
# HTTP Endpoint
# =============================================================================


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
    profile_id = http_request.state.profile_id

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

        # Fetch activity data (+ optional session history in parallel)
        parallel_tasks: list = [
            get_activity_internal(
                pool=pool,
                profile_id=profile_id,
                bypass_cache=bypass_cache,
                profile_id_filter=request.profile_id,
                profile_ids_filter=filter_profile_ids,
                date_from=request.date_from,
                date_to=request.date_to,
                page_limit=request.page_limit,
                page_offset=request.page_offset,
            )
        ]
        if request.history_enabled:
            parallel_tasks.append(
                _fetch_session_history_data(
                    pool, profile_id, request, filter_profile_ids, bypass_cache
                )
            )

        parallel_results = await asyncio.gather(*parallel_tasks)
        data = parallel_results[0]
        history_data: GetSessionListResponse | None = (
            parallel_results[1] if request.history_enabled else None
        )

        # Build chart_data from activity view (date_key + event_type + event_count)
        chart_data = [
            ActivityChartPoint(
                date=str(item.date_key),
                event_id=item.event_type or "",
                count=item.event_count,
            )
            for item in data.activity_result.items
        ]

        # Build available_events by aggregating activity items by event_type
        event_totals: dict[str, int] = defaultdict(int)
        for item in data.activity_result.items:
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
        sessions_count = data.sessions_result.total_count
        active_profiles_count = data.activity_result.total_count
        logins_count = data.logins_result.total_count

        # Compute emulations count from grants
        emulations_count = sum(
            1 for g in data.grants_result.items if g.emulation_id is not None
        )

        # Build views container
        views = ActivityViews(
            sessions=data.sessions_result.items,
            activity=data.activity_result.items,
            logins=data.logins_result.items,
            audits=data.audits_result.items,
            problems=data.problems_result.items,
            grants=data.grants_result.items,
        )

        # Collect profile_ids for resources
        profile_ids: set[str] = set()
        for item in data.sessions_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
        for item in data.logins_result.items:
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
            problems=data.problems_result.items,
            views=views,
            resources=resources,
            total_count=data.sessions_result.total_count,
            history=history_data,
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


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_activity_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    activity_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetActivityWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + domain views."""
    data = await get_activity_internal(
        pool=pool,
        profile_id=profile_id,
        bypass_cache=bypass_cache,
    )

    return GetActivityWebsocketResponse(
        views=ActivityWebsocketViews(
            runs=data.runs_today,
            sessions=data.sessions_result.items,
            activity=data.activity_result.items,
            logins=data.logins_result.items,
            audits=data.audits_result.items,
            problems=data.problems_result.items,
            grants=data.grants_result.items,
        ),
        resources=ActivityWebsocketResources(
            config_agents=data.config_agents or None,
            config_models=data.config_models or None,
            config_providers=data.config_providers or None,
            config_tools=data.config_tools or None,
            config_profile=data.config_profile or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )

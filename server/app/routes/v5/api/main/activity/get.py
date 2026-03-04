"""Get endpoint for activity artifact."""

import asyncio
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main._shared.pricing import compute_costs_from_runs
from app.routes.v5.api.main.activity.types import (
    ActivityInternalData,
    ActivityRequest,
    ActivityResources,
    ActivityResponse,
    ActivityViews,
    ActivityWebsocketEntries,
    ActivityWebsocketResources,
    GetActivityApiRequest,
    GetActivityWebsocketResponse,
    ProfileSummaryItem,
)
from app.routes.v5.api.main.session.types import (
    GetSessionListRequest,
    GetSessionListResponse,
    SessionListItem,
)
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.entries.activity.get import get_activity_list_view_internal
from app.routes.v5.tools.entries.activity.profile_summary import (
    get_profile_summary_view_internal,
)
from app.routes.v5.tools.entries.grants.get import get_grant_list_view_internal
from app.routes.v5.tools.entries.groups.get import get_group_list_view_internal
from app.routes.v5.tools.entries.logins.get import get_login_list_view_internal
from app.routes.v5.tools.entries.problems.get import get_problem_list_view_internal
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.entries.sessions.get import (
    get_session_counts_view_internal,
    get_session_list_view_internal,
)
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.sql.types import (
    GetActivityListViewSqlRow,
    GetGrantListViewSqlRow,
    GetLoginListViewSqlRow,
    GetProblemListViewSqlRow,
    GetProfileSummaryViewSqlRow,
    GetSessionListViewSqlRow,
    QGetProfilesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

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
    summary_profile_id: UUID | None = None,
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

    async def fetch_runs_today() -> Any:
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

    async def fetch_profile_summary() -> GetProfileSummaryViewSqlRow:
        async with pool.acquire() as c:
            return await get_profile_summary_view_internal(
                conn=c,
                profile_id_filter=summary_profile_id,
                bypass_cache=bypass_cache,
            )

    (
        activity_result,
        sessions_result,
        logins_result,
        problems_result,
        grants_result,
        config_profile_result,
        runs_result,
        profile_summary_result,
    ) = await asyncio.gather(
        fetch_activity(),
        fetch_sessions(),
        fetch_logins(),
        fetch_problems(),
        fetch_grants(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_profile_summary(),
    )

    return ActivityInternalData(
        activity_result=activity_result,
        sessions_result=sessions_result,
        logins_result=logins_result,
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
        profile_summary_result=profile_summary_result,
    )


async def get_session_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetSessionListRequest,
    actor_name: str | None = None,
    profile_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v5/artifacts/session/list",
) -> GetSessionListResponse:
    """Internal function for session list with resource hydration."""
    body = request.model_dump(mode="json")
    body["profile_id"] = str(profile_id)
    if profile_ids:
        body["profile_ids"] = [str(p) for p in profile_ids]
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetSessionListResponse.model_validate(cached["data"])

    # Pass 1: Get paginated sessions from sessions_mv
    view_result = await get_session_list_view_internal(
        conn=conn,
        profile_id_filter=profile_id if not profile_ids else None,
        profile_ids_filter=profile_ids,
        active_filter=request.active,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    session_ids = [item.session_id for item in view_result.items]

    if not session_ids:
        total_count = view_result.total_count
        page_limit = request.page_limit
        page_offset = request.page_offset
        page = page_offset // page_limit if page_limit else 0
        total_pages = (total_count + page_limit - 1) // page_limit if page_limit else 0
        return GetSessionListResponse(
            actor_name=actor_name,
            items=[],
            total_count=total_count,
            page=page,
            page_size=page_limit,
            total_pages=total_pages,
        )

    # Pass 2: Batch fetch groups via view internals (with session_ids filter)
    all_profile_ids = list(
        {item.profile_id for item in view_result.items if item.profile_id}
    )

    groups_result, profile_name_items, session_counts = await asyncio.gather(
        get_group_list_view_internal(
            conn=conn,
            session_ids=session_ids,
            page_limit=10000,
            bypass_cache=bypass_cache,
        ),
        get_names(conn, all_profile_ids, cache),
        get_session_counts_view_internal(conn, session_ids, cache),
    )

    # Build profile name lookup
    profile_names = {
        item.id: item.name for item in profile_name_items if item.id and item.name
    }

    # Compute group counts per session
    group_counts: dict[UUID, int] = defaultdict(int)
    group_ids: list[UUID] = []
    for g in groups_result.items:
        if g.session_id:
            group_counts[g.session_id] += 1
            group_ids.append(g.group_id)

    # Fetch runs for these groups
    runs_result = await get_run_list_entries_internal(
        conn=conn,
        group_ids=group_ids if group_ids else None,
        page_limit=10000,
        cache=cache,
    )

    # Compute costs from runs
    run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

    # Build group_id → session_id mapping
    group_to_session: dict[UUID, UUID] = {}
    for g in groups_result.items:
        if g.session_id:
            group_to_session[g.group_id] = g.session_id

    # Aggregate run stats per session
    run_counts: dict[UUID, int] = defaultdict(int)
    total_tokens_map: dict[UUID, int] = defaultdict(int)
    total_cost_map: dict[UUID, Decimal] = defaultdict(Decimal)
    first_run_at: dict[UUID, object] = {}
    last_run_at: dict[UUID, object] = {}
    for run in runs_result.items:
        sid = group_to_session.get(run.group_id) if run.group_id else None
        if not sid:
            continue
        run_counts[sid] += 1
        total_tokens_map[sid] += (
            run.input_tokens + run.output_tokens + run.cached_input_tokens
        )
        total_cost_map[sid] += run_costs.get(run.run_id, Decimal("0"))
        if run.run_created_at:
            existing_first = first_run_at.get(sid)
            if existing_first is None or run.run_created_at < existing_first:
                first_run_at[sid] = run.run_created_at
            existing_last = last_run_at.get(sid)
            if existing_last is None or run.run_created_at > existing_last:
                last_run_at[sid] = run.run_created_at

    # Assemble items
    items = []
    for view_item in view_result.items:
        sid = view_item.session_id
        counts = session_counts.get(sid)

        items.append(
            SessionListItem(
                session_id=sid,
                profile_id=view_item.profile_id,
                profile_name=profile_names.get(view_item.profile_id)
                if view_item.profile_id
                else None,
                session_created_at=view_item.session_created_at,
                active=view_item.active,
                group_count=group_counts.get(sid, 0),
                run_count=run_counts.get(sid, 0),
                first_run_at=first_run_at.get(sid),
                last_run_at=last_run_at.get(sid),
                total_tokens=total_tokens_map.get(sid, 0),
                total_cost=total_cost_map.get(sid, Decimal("0")),
                chat_count=counts.chat_count or 0 if counts else 0,
                attempt_count=counts.attempt_count or 0 if counts else 0,
                message_count=counts.message_count or 0 if counts else 0,
                problem_count=counts.problem_count or 0 if counts else 0,
            )
        )

    total_count = view_result.total_count
    page_limit = request.page_limit
    page_offset = request.page_offset
    page = page_offset // page_limit if page_limit else 0
    total_pages = (total_count + page_limit - 1) // page_limit if page_limit else 0

    api_response = GetSessionListResponse(
        actor_name=actor_name,
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_limit,
        total_pages=total_pages,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "session", "list"],
    )

    return api_response


async def _fetch_session_history_data(
    pool: asyncpg.Pool,
    profile_id: UUID,
    request: ActivityRequest,
    filter_profile_ids: list[UUID] | None,
    bypass_cache: bool,
) -> GetSessionListResponse:
    """Fetch session list history inline."""
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


@router.post("/get", response_model=ActivityResponse)
async def get_activity(
    request: ActivityRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ActivityResponse:
    """Get activity artifact data."""
    tags = ["artifacts", "activity"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)
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
                summary_profile_id=request.summary_profile_id,
            )
        ]
        parallel_tasks.append(
            _fetch_session_history_data(
                pool, profile_id, request, filter_profile_ids, bypass_cache
            )
        )

        parallel_results = await asyncio.gather(*parallel_tasks)
        data = parallel_results[0]
        history_data: Any = parallel_results[1]

        # Build profile summary from profile_summary_result
        profile_summary: list[ProfileSummaryItem] = []
        if data.profile_summary_result and data.profile_summary_result.items:
            # Collect profile IDs for name resolution
            summary_pids = [
                i.profile_id for i in data.profile_summary_result.items if i.profile_id
            ]
            summary_names: dict[UUID, str] = {}
            if summary_pids:
                async with pool.acquire() as c:
                    name_items = await get_names(c, summary_pids, cache)
                    summary_names = {
                        i.id: i.name for i in name_items if i.id and i.name
                    }
            for item in data.profile_summary_result.items:
                profile_summary.append(
                    ProfileSummaryItem(
                        profile_id=item.profile_id,
                        profile_name=summary_names.get(item.profile_id)
                        if item.profile_id
                        else None,
                        sessions_count=item.sessions_count or 0,
                        logins_count=item.logins_count or 0,
                        grants_count=item.grants_count or 0,
                        problems_count=item.problems_count or 0,
                        activity_count=item.activity_count or 0,
                    )
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
            profile_summary=profile_summary,
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
        cache=cache,
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_tools = data.config_tools or []
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c, list(set(all_args_ids)), cache=cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c, list(set(all_args_output_ids)), cache=cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetActivityWebsocketResponse(
        entries=ActivityWebsocketEntries(
            runs=data.runs_today,
            sessions=data.sessions_result.items,
            activity=data.activity_result.items,
            logins=data.logins_result.items,
            problems=data.problems_result.items,
            grants=data.grants_result.items,
        ),
        resources=ActivityWebsocketResources(),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=data.config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        params=GetActivityApiRequest(activity_id=activity_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )

"""Session detail endpoint - POST /artifacts/session/get.

Uses view internals only — no raw SQL in artifact layer.
Fetches from sessions_mv, groups_mv, audits_mv, runs_mv via view layer,
then aggregates in Python.
"""

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts._shared.pricing import compute_costs_from_runs
from app.api.v4.artifacts.session.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
    GetSessionDetailRequest,
    GetSessionDetailResponse,
    GetSessionWebsocketResponse,
    SessionInternalData,
    SessionWebsocketResources,
    SessionWebsocketViews,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.audits.get import get_audit_list_view_internal
from app.api.v4.entries.groups.get import get_group_list_view_internal
from app.api.v4.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.api.v4.entries.sessions.get import get_session_list_view_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAuditListViewSqlRow,
    GetGroupListViewSqlRow,
    QGetProfilesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()

# Session resource types for agent resolution (empty — session has no domain resources)
SESSION_BUNDLE_RESOURCES: set[str] = set()


# =============================================================================
# Internal Layer
# =============================================================================


async def get_session_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    session_id: UUID,
    bypass_cache: bool = False,
    audit_limit: int = 50,
    audit_offset: int = 0,
) -> SessionInternalData:
    """Fetch both domain views and config chain for a session.

    Returns a SessionInternalData dataclass consumed by both the HTTP
    endpoint and the websocket wrapper.
    """
    # 1. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, _create_tool_ids, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, SESSION_BUNDLE_RESOURCES
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

    # 2. Resolve actor context
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=False,
        )
        actor_name = profile_ctx.access.actor_name

    # 3. Verify session exists
    async with pool.acquire() as conn:
        session_view = await get_session_list_view_internal(
            conn=conn,
            session_ids=[session_id],
            bypass_cache=bypass_cache,
        )

    if not session_view.items:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {session_id}",
        )

    session = session_view.items[0]

    # 4. Parallel fetch: groups, audits, config profile, runs today
    async def fetch_groups() -> GetGroupListViewSqlRow:
        async with pool.acquire() as c:
            return await get_group_list_view_internal(
                conn=c,
                session_id_filter=session_id,
                page_limit=1000,
                bypass_cache=bypass_cache,
            )

    async def fetch_audits() -> GetAuditListViewSqlRow:
        async with pool.acquire() as c:
            return await get_audit_list_view_internal(
                conn=c,
                session_id_filter=session_id,
                page_limit=audit_limit,
                page_offset=audit_offset,
                bypass_cache=bypass_cache,
            )

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
        groups_result,
        audits_result,
        config_profile_result,
        runs_today_result,
    ) = await asyncio.gather(
        fetch_groups(),
        fetch_audits(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    # 5. Fetch runs for groups (needs group IDs from step 4)
    group_ids = [g.group_id for g in groups_result.items]
    async with pool.acquire() as conn:
        runs_result = await get_run_list_entries_internal(
            conn=conn,
            group_ids=group_ids if group_ids else None,
            page_limit=10000,
            bypass_cache=bypass_cache,
        )

    # 6. Get profile name
    profile_name = None
    if session.profile_id:
        async with pool.acquire() as conn:
            name_items = await get_names_internal(
                conn, [session.profile_id], bypass_cache
            )
            if name_items:
                profile_name = name_items[0].name

    return SessionInternalData(
        session_view=session_view,
        groups_result=groups_result,
        audits_result=audits_result,
        runs_result=runs_result,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_profile=config_profile_result,
        runs_today=runs_today_result,
        resource_agent_ids=agent_ids,
        group_id=None,
        actor_name=actor_name,
        profile_name=profile_name,
    )


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/get",
    response_model=GetSessionDetailResponse,
    dependencies=[
        audit_activity(
            "artifacts.session.get", "{{ actor.name }} viewed session detail"
        )
    ],
)
async def get_session(
    request: GetSessionDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionDetailResponse:
    """Get session detail with paginated audits and groups."""
    tags = ["artifacts", "session"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Check for cached response
        body_dict = request.model_dump(mode="json")
        body_dict["profile_id"] = str(profile_id)
        cache_key_val = cache_key(http_request.url.path, body_dict)

        if not bypass_cache:
            cached = await get_cached(cache_key_val)
            if cached:
                response.headers["X-Cache-Tags"] = ",".join(tags)
                response.headers["X-Cache-Hit"] = "1"
                return GetSessionDetailResponse.model_validate(cached["data"])

        pool = get_pool()
        data = await get_session_internal(
            pool=pool,
            profile_id=profile_id,
            session_id=request.session_id,
            bypass_cache=bypass_cache,
            audit_limit=request.audit_limit,
            audit_offset=request.audit_offset,
        )

        session = data.session_view.items[0]

        # Set audit context
        if data.actor_name:
            audit_set(http_request, actor={"name": data.actor_name, "id": profile_id})

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(
            conn, data.runs_result.items, bypass_cache
        )

        # Aggregate run stats per group
        group_run_aggs: dict[UUID, dict] = {}
        for run in data.runs_result.items:
            gid = run.group_id
            if not gid:
                continue
            if gid not in group_run_aggs:
                group_run_aggs[gid] = {
                    "run_count": 0,
                    "total_tokens": 0,
                    "total_cost": Decimal("0"),
                    "first_run_at": None,
                    "last_run_at": None,
                }
            agg = group_run_aggs[gid]
            agg["run_count"] += 1
            agg["total_tokens"] += (
                run.input_tokens + run.output_tokens + run.cached_input_tokens
            )
            agg["total_cost"] += run_costs.get(run.run_id, Decimal("0"))
            if run.run_created_at:
                if (
                    agg["first_run_at"] is None
                    or run.run_created_at < agg["first_run_at"]
                ):
                    agg["first_run_at"] = run.run_created_at
                if (
                    agg["last_run_at"] is None
                    or run.run_created_at > agg["last_run_at"]
                ):
                    agg["last_run_at"] = run.run_created_at

        # Build groups with run aggregates
        groups = []
        for g in data.groups_result.items:
            agg = group_run_aggs.get(g.group_id, {})
            groups.append(
                ArtifactSessionGroup(
                    group_id=g.group_id,
                    group_name=g.group_name,
                    trace_id=g.trace_id,
                    first_run_at=agg.get("first_run_at"),
                    last_run_at=agg.get("last_run_at"),
                    run_count=agg.get("run_count", 0),
                    total_tokens=agg.get("total_tokens", 0),
                    total_cost=agg.get("total_cost", Decimal("0")),
                )
            )

        # Build audits
        audits = [
            ArtifactSessionAudit(
                id=a.audit_id,
                created_at=a.audit_created_at,
                message=a.message,
                endpoint=a.endpoint,
                error=a.error,
            )
            for a in data.audits_result.items
        ]

        api_response = GetSessionDetailResponse(
            actor_name=data.actor_name,
            session_exists=True,
            session_id=session.session_id,
            profile_id=session.profile_id,
            profile_name=data.profile_name,
            session_created_at=session.session_created_at,
            active=session.active,
            audit_total_count=data.audits_result.total_count,
            audits=audits,
            groups=groups,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_session_get",
            request=http_request,
        )


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_session_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSessionWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + domain views."""
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required for websocket.",
        )

    data = await get_session_internal(
        pool=pool,
        profile_id=profile_id,
        session_id=session_id,
        bypass_cache=bypass_cache,
    )

    return GetSessionWebsocketResponse(
        views=SessionWebsocketViews(
            runs=data.runs_today,
            groups=data.groups_result.items if data.groups_result.items else None,
            audits=data.audits_result.items if data.audits_result.items else None,
        ),
        resources=SessionWebsocketResources(
            config_agents=data.config_agents or None,
            config_models=data.config_models or None,
            config_providers=data.config_providers or None,
            config_tools=data.config_tools or None,
            config_profile=data.config_profile or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )

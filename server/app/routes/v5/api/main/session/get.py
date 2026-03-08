"""Session detail endpoint - POST /artifacts/session/get.

Three-layer BFF pattern:
- get_session_internal(): Core data fetcher via context resolver, returns SessionInternalData
- get_session (HTTP route): HTTP response layer with caching
- get_session_websocket(): WebSocket response layer

Uses composable context resolver with black-box MV search tools.
Zero inline SQL — all data from context resolver + resource fetchers.
"""

import asyncio
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.session_context import resolve_session_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main._shared.pricing import compute_costs_from_runs
from app.routes.v5.api.main.session.types import (
    ArtifactSessionGroup,
    GetSessionApiRequest,
    GetSessionDetailRequest,
    GetSessionDetailResponse,
    GetSessionWebsocketResponse,
    SessionInternalData,
    SessionTimelineItem,
    SessionWebsocketEntries,
    SessionWebsocketResources,
)
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Session entry types for tool scoring
SESSION_BUNDLE_ENTRIES: set[str] = {"problems"}


# =============================================================================
# Layer 1: Core data fetcher (context resolver → pure Python assembly)
# =============================================================================


async def get_session_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    session_id: UUID,
    bypass_cache: bool = False,
) -> SessionInternalData:
    """Core session detail fetcher.

    Resolves session context (domain data) and common context (config chain)
    in parallel, then assembles SessionInternalData.
    """
    redis = get_redis_client()

    # Phase 0: Resolve both contexts in parallel
    async def _resolve_session() -> object:
        return await resolve_session_context(
            pool, redis, session_id=session_id, profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    async def _resolve_common() -> object:
        async with pool.acquire() as c:
            return await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )

    ctx, common = await asyncio.gather(
        _resolve_session(),
        _resolve_common(),
    )

    # Extract domain entries from session context
    session = ctx.entries.get("session")
    groups = ctx.entries.get("groups", [])
    runs = ctx.entries.get("runs", [])
    logins = ctx.entries.get("logins", [])
    problems = ctx.entries.get("problems", [])
    chats = ctx.entries.get("chats", [])
    attempt_homes = ctx.entries.get("attempt_homes", [])
    practices = ctx.entries.get("practices", [])
    actor_name_items = ctx.entries.get("actor_name_items", [])
    actor_name = actor_name_items[0].name if actor_name_items else None

    if not session:
        return SessionInternalData(
            session_exists=False,
            actor_name=actor_name,
        )

    # Extract resource maps from session context
    names_rp = ctx.resources.get("names")
    names_list = names_rp.selected if names_rp else []
    name_map = {item.id: item.name for item in names_list if item.id and item.name}

    # Profile name from name_map
    profile_name = name_map.get(session.profile_id) if session.profile_id else None

    # Build config chain from common context (if available)
    config_agents: list = []
    config_models: list = []
    config_providers: list = []
    config_tools: list = []
    config_systems: list = []
    config_profile: list = []
    runs_today = None
    resource_agent_ids: dict[str, UUID | None] = {}
    resource_system_ids: dict[str, UUID | None] = {}

    if common:
        scores = score_tools(common.tool_graph, SESSION_BUNDLE_ENTRIES)
        resource_agent_ids = {
            target: (tool.agent_id if tool else None)
            for target, tool in scores.best.items()
        }
        resource_system_ids = {
            target: (tool.system_id if tool else None)
            for target, tool in scores.best.items()
        }

        # Hydrate config chain from tool_graph
        all_system_ids = list(dict.fromkeys(
            t.system_id for t in common.tool_graph.tools
        ))
        all_agent_ids = list(dict.fromkeys(
            t.agent_id for t in common.tool_graph.tools
        ))
        all_tool_ids = list(dict.fromkeys(
            t.tool_id for t in common.tool_graph.tools
        ))

        async def _fetch_systems() -> list:
            if not all_system_ids:
                return []
            async with pool.acquire() as c:
                return await get_systems(c, all_system_ids, redis, bypass_cache)

        async def _fetch_agents() -> list:
            if not all_agent_ids:
                return []
            async with pool.acquire() as c:
                return await get_agents(c, all_agent_ids, redis, bypass_cache)

        async def _fetch_tools_config() -> list:
            if not all_tool_ids:
                return []
            async with pool.acquire() as c:
                return await get_tools(c, all_tool_ids, redis, bypass_cache)

        config_systems, config_agents, config_tools = await asyncio.gather(
            _fetch_systems(),
            _fetch_agents(),
            _fetch_tools_config(),
        )

        # Walk agent → model → provider chain
        model_ids = list(dict.fromkeys(
            a.model_id for a in config_agents if a.model_id
        ))
        if model_ids:
            async with pool.acquire() as c:
                config_models = await get_models(c, model_ids, redis, bypass_cache)

        provider_ids = list(dict.fromkeys(
            m.provider_id for m in config_models if m.provider_id
        ))
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers(
                    c, provider_ids, redis, bypass_cache
                )

        # Config profile
        if common.profile:
            from app.routes.v5.tools.resources.profiles.get import get_profiles

            async with pool.acquire() as c:
                config_profile = await get_profiles(
                    c, [common.profile.profiles_id], redis, bypass_cache
                )

        runs_today = common.runs.runs if common.runs else None

    return SessionInternalData(
        session_exists=True,
        session=session,
        groups=groups,
        runs=runs,
        logins=logins,
        problems=problems,
        chats=chats,
        attempt_homes=attempt_homes,
        practices=practices,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_systems=config_systems,
        config_profile=config_profile,
        runs_today=runs_today,
        resource_agent_ids=resource_agent_ids,
        resource_system_ids=resource_system_ids,
        group_id=None,
        actor_name=actor_name,
        profile_name=profile_name,
        name_map=name_map,
    )


# =============================================================================
# Layer 2b: WebSocket response
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

    redis = get_redis_client()

    # Pre-fetch args and args_outputs from tool IDs
    config_args = None
    config_args_outputs = None
    config_tools = data.config_tools
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():  # noqa: ANN202
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c,
                        list(set(all_args_ids)),
                        redis,
                        bypass_cache=bypass_cache,
                    )

            async def fetch_args_outputs():  # noqa: ANN202
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c,
                        list(set(all_args_output_ids)),
                        redis,
                        bypass_cache=bypass_cache,
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetSessionWebsocketResponse(
        entries=SessionWebsocketEntries(
            runs=data.runs_today,
            groups=data.groups or None,
        ),
        resources=SessionWebsocketResources(),
        systems=data.config_systems or None,
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        params=GetSessionApiRequest(session_id=session_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        resource_system_ids=data.resource_system_ids,
        group_id=data.group_id,
    )


# =============================================================================
# Layer 2a: HTTP Endpoint
# =============================================================================


@router.post("/get", response_model=GetSessionDetailResponse)
async def get_session(
    request: GetSessionDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionDetailResponse:
    """Get session detail with groups and timeline."""
    tags = ["artifacts", "session"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetSessionDetailResponse.model_validate(cached["data"])

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        data = await get_session_internal(
            pool=pool,
            profile_id=profile_id,
            session_id=request.session_id,
            bypass_cache=bypass_cache,
        )

        if not data.session_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Session not found: {request.session_id}",
            )

        session = data.session

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(
            conn, data.runs, bypass_cache
        )

        # Aggregate run stats per group
        group_run_aggs: dict[UUID, dict] = {}
        for run in data.runs:
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
        for g in data.groups:
            agg = group_run_aggs.get(g.id, {})
            groups.append(
                ArtifactSessionGroup(
                    group_id=g.id,
                    group_name=g.name,
                    first_run_at=agg.get("first_run_at"),
                    last_run_at=agg.get("last_run_at"),
                    run_count=agg.get("run_count", 0),
                    total_tokens=agg.get("total_tokens", 0),
                    total_cost=agg.get("total_cost", Decimal("0")),
                )
            )

        # Build timeline from raw entries (pure Python assembly)
        timeline = _build_timeline(data)

        api_response = GetSessionDetailResponse(
            actor_name=data.actor_name,
            session_exists=True,
            session_id=session.id,
            profile_id=session.profile_id,
            profile_name=data.profile_name,
            session_created_at=session.created_at,
            active=session.active,
            groups=groups,
            timeline=timeline,
        )

        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
            redis=get_redis_client(),
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
# Timeline Assembly (pure Python)
# =============================================================================


def _build_timeline(data: SessionInternalData) -> list[SessionTimelineItem]:
    """Merge all timeline source entries into a sorted list.

    Sources: groups, logins, problems, chats, attempt_homes, practices.
    Sorted by created_at ascending to match original SQL UNION ordering.
    """
    items: list[SessionTimelineItem] = []

    # Groups
    for g in data.groups:
        items.append(SessionTimelineItem(
            event_type="group",
            entity_id=g.id,
            entity_name=g.name,
            created_at=g.created_at,
        ))

    # Logins
    for login in data.logins:
        items.append(SessionTimelineItem(
            event_type="login",
            entity_id=login.id,
            created_at=login.created_at,
        ))

    # Problems
    for p in data.problems:
        items.append(SessionTimelineItem(
            event_type="problem",
            entity_id=p.id,
            entity_name=p.type,
            created_at=p.created_at,
            extra_1=p.message,
        ))

    # Chats (from chat_mv — returns dicts)
    for c in data.chats:
        chat_id = c.get("chat_entry_id") if isinstance(c, dict) else getattr(c, "chat_entry_id", None)
        chat_name = c.get("name") if isinstance(c, dict) else getattr(c, "name", None)
        chat_created = c.get("created_at") if isinstance(c, dict) else getattr(c, "created_at", None)
        items.append(SessionTimelineItem(
            event_type="chat",
            entity_id=chat_id,
            entity_name=chat_name,
            created_at=chat_created,
        ))

    # Attempt homes
    for ah in data.attempt_homes:
        items.append(SessionTimelineItem(
            event_type="attempt",
            entity_id=ah.attempt_id,
            created_at=ah.created_at,
        ))

    # Practices
    for pr in data.practices:
        items.append(SessionTimelineItem(
            event_type="practice",
            entity_id=pr.id,
            created_at=pr.created_at,
        ))

    # Sort by created_at ascending
    items.sort(key=lambda x: x.created_at or x.created_at, reverse=False)

    return items

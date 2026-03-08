"""Group artifact endpoint - POST /artifacts/group/get

Three-layer BFF pattern:
- get_group_internal(): Core data fetcher via context resolver, returns GroupInternalData
- get_group (HTTP route): HTTP response layer with caching
- get_group_websocket(): WebSocket response layer

Uses composable context resolver with black-box MV search tools.
Zero inline SQL — all data from context resolver + resource fetchers.
"""

import asyncio
from collections import defaultdict
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.group_context import resolve_group_context
from app.infra.tool_graph import score_tools
from app.infra.pricing import compute_costs_from_runs
from app.routes.v5.api.main.group.types import (
    GetGroupDetailRequest,
    GetGroupDetailResponse,
    GroupDetailCallItem,
    GroupDetailMessageItem,
    GroupDetailResourceItem,
    GroupDetailRunItem,
    GroupDetailRunWithMessages,
    GroupInternalData,
)
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Group entry types for tool scoring
GROUP_BUNDLE_ENTRIES: set[str] = {"problems"}


# =============================================================================
# Layer 1: Core data fetcher (context resolver → pure Python assembly)
# =============================================================================


async def get_group_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GroupInternalData:
    """Core group detail fetcher.

    Resolves group context (domain data) and common context (config chain)
    in parallel, then assembles GroupInternalData.
    """
    redis = get_redis_client()

    # Phase 0: Resolve both contexts in parallel
    async def _resolve_group() -> object:
        return await resolve_group_context(
            pool, redis, group_id=group_id, profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    async def _resolve_common() -> object:
        async with pool.acquire() as c:
            return await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )

    ctx, common = await asyncio.gather(
        _resolve_group(),
        _resolve_common(),
    )

    # Extract domain entries from group context
    runs = ctx.entries.get("runs", [])
    messages = ctx.entries.get("messages", [])
    calls = ctx.entries.get("calls", [])
    actor_name_items = ctx.entries.get("actor_name_items", [])
    actor_name = actor_name_items[0].name if actor_name_items else None

    if not runs:
        return GroupInternalData(
            group_exists=False,
            actor_name=actor_name,
            group_id=group_id,
        )

    # Extract resource maps from group context
    names_rp = ctx.resources.get("names")
    names_list = names_rp.selected if names_rp else []
    tools_rp = ctx.resources.get("tools")
    tools_list = tools_rp.selected if tools_rp else []

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
        scores = score_tools(common.tool_graph, GROUP_BUNDLE_ENTRIES)
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

        runs_today = common.runs if common.runs else None

    return GroupInternalData(
        group_exists=True,
        runs=runs,
        messages=messages,
        calls=calls,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_systems=config_systems,
        config_profile=config_profile,
        runs_today=runs_today,
        resource_agent_ids=resource_agent_ids,
        resource_system_ids=resource_system_ids,
        group_id=group_id,
        actor_name=actor_name,
        name_map={item.id: item.name for item in names_list if item.id and item.name},
        tool_name_map={
            item.id: item.name for item in tools_list if item.id and item.name
        },
    )


# =============================================================================
# Layer 2: HTTP Endpoint
# =============================================================================


@router.post("/get", response_model=GetGroupDetailResponse)
async def get_group(
    request: GetGroupDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupDetailResponse:
    """Get detailed group information with all runs and messages."""
    tags = ["artifacts", "group", "detail"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetGroupDetailResponse.model_validate(cached["data"])

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        data = await get_group_internal(
            pool=pool,
            profile_id=profile_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        if not data.group_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        if not data.runs:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. "
                "It may be restricted to other departments.",
            )

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(conn, data.runs, bypass_cache)

        # Group messages by run_id
        run_messages: dict[UUID, list] = defaultdict(list)
        for msg in data.messages:
            if msg.run_id:
                run_messages[msg.run_id].append(msg)

        # Group calls by run_id
        calls_by_run: dict[UUID, list] = defaultdict(list)
        for call in data.calls:
            if call.run_id:
                calls_by_run[call.run_id].append(call)

        # Collect IDs for display
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        for r in data.runs:
            if r.model_ids:
                all_model_ids.update(r.model_ids)
            if r.agent_ids:
                all_agent_ids.update(r.agent_ids)

        # Build runs with messages (pure Python assembly from context data)
        runs: list[GroupDetailRunWithMessages] = []
        for r in data.runs:
            run_id = r.run_id

            agent_id = r.agent_ids[0] if r.agent_ids else None
            model_id = r.model_ids[0] if r.model_ids else None

            run_item = GroupDetailRunItem(
                id=run_id,
                created_at=r.run_created_at,
                input_tokens=r.input_tokens,
                output_tokens=r.output_tokens,
                cached_input_tokens=r.cached_input_tokens,
                cost=float(run_costs.get(run_id, 0)),
                model_id=model_id,
                agent_id=agent_id,
                profile_id=None,
            )

            # Build messages
            messages: list[GroupDetailMessageItem] = []
            for msg in run_messages.get(run_id, []):
                messages.append(
                    GroupDetailMessageItem(
                        id=msg.message_id,
                        role=msg.role,
                        text_upload_ids=list(msg.text_upload_ids or []),
                        audio_upload_ids=list(msg.audio_upload_ids or []),
                        image_upload_ids=list(msg.image_upload_ids or []),
                        video_upload_ids=list(msg.video_upload_ids or []),
                        file_upload_ids=list(msg.file_upload_ids or []),
                        call_upload_ids=list(msg.call_upload_ids or []),
                    )
                )

            # Attach calls to the last message of the run
            run_calls = calls_by_run.get(run_id, [])
            if run_calls and messages:
                for call in run_calls:
                    messages[-1].calls.append(
                        GroupDetailCallItem(
                            id=call.call_id,
                            template_name=data.tool_name_map.get(call.tool_id)
                            if call.tool_id
                            else None,
                            file_path=call.file_path,
                            created_at=call.call_created_at,
                        )
                    )

            runs.append(
                GroupDetailRunWithMessages(
                    run=run_item,
                    messages=messages,
                    previous_context_start_index=None,
                )
            )

        # Build resource arrays (names from context)
        models_list = [
            GroupDetailResourceItem(
                model_id=mid, name=data.name_map.get(mid)
            )
            for mid in all_model_ids
        ]
        agents_list = [
            GroupDetailResourceItem(
                agent_id=aid, name=data.name_map.get(aid)
            )
            for aid in all_agent_ids
        ]
        profiles_list = [
            GroupDetailResourceItem(
                profile_id=pid, name=data.name_map.get(pid)
            )
            for pid in all_profile_ids
        ]

        api_response = GetGroupDetailResponse(
            group_exists=True,
            actor_name=data.actor_name,
            runs=runs,
            models=models_list,
            agents=agents_list,
            profiles=profiles_list,
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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_group",
            request=http_request,
        )

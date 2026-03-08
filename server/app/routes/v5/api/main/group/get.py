"""Group artifact endpoint - POST /artifacts/group/get

Canonical composable pattern:
  resolve_common_context() → config chain hydration + MV search tools → Python assembly.

Zero inline SQL — all data from context resolver + MV search tools + resource fetchers.
"""

import asyncio
from collections import defaultdict
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main._shared.pricing import compute_costs_from_runs
from app.routes.v5.api.main.group.types import (
    GetGroupApiRequest,
    GetGroupDetailRequest,
    GetGroupDetailResponse,
    GetGroupWebsocketResponse,
    GroupDetailCallItem,
    GroupDetailMessageItem,
    GroupDetailResourceItem,
    GroupDetailRunItem,
    GroupDetailRunWithMessages,
    GroupInternalData,
    GroupWebsocketEntries,
    GroupWebsocketResources,
)
from app.routes.v5.tools.entries.calls.search import search_calls
from app.routes.v5.tools.entries.groups.search import search_groups
from app.routes.v5.tools.entries.messages.search import search_messages
from app.routes.v5.tools.entries.runs.search import search_runs
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
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
# Internal Layer
# =============================================================================


async def get_group_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GroupInternalData:
    """Fetch both domain views and config chain for a group.

    Uses resolve_common_context() for profile + tool_graph + runs,
    then hydrates config chain from tool_graph + fetches domain data from MV search tools.
    """
    redis = get_redis_client()

    # Phase 0: Resolve common context (profile + tool_graph + runs)
    async with pool.acquire() as c:
        common = await resolve_common_context(
            c, redis, profile_id=profile_id, bypass_cache=bypass_cache
        )
    if not common:
        return GroupInternalData()

    # Phase 1: Score tools + extract IDs from tool_graph
    scores = score_tools(common.tool_graph, GROUP_BUNDLE_ENTRIES)

    all_system_ids = list(dict.fromkeys(t.system_id for t in common.tool_graph.tools))
    all_agent_ids = list(dict.fromkeys(t.agent_id for t in common.tool_graph.tools))
    all_tool_ids = list(dict.fromkeys(t.tool_id for t in common.tool_graph.tools))

    # Phase 2: Parallel fetch — config chain + domain data + actor name
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

    async def _fetch_tools() -> list:
        if not all_tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools(c, all_tool_ids, redis, bypass_cache)

    async def _fetch_actor_name() -> str | None:
        async with pool.acquire() as c:
            items = await get_names(c, [profile_id], redis, bypass_cache=bypass_cache)
        return items[0].name if items else None

    async def _fetch_group() -> list:
        async with pool.acquire() as c:
            return await search_groups(c, limit=1)

    async def _fetch_runs() -> list:
        async with pool.acquire() as c:
            return await search_runs(
                c, group_ids=[group_id], sort_order="asc", limit=10000
            )

    (
        systems,
        agents,
        tools_list,
        actor_name,
        _group_items,
        runs,
    ) = await asyncio.gather(
        _fetch_systems(),
        _fetch_agents(),
        _fetch_tools(),
        _fetch_actor_name(),
        _fetch_group(),
        _fetch_runs(),
    )

    if not runs:
        return GroupInternalData(
            group_exists=False,
            actor_name=actor_name,
            group_id=group_id,
        )

    # Phase 3: Sequential — models from agents, providers from models
    model_ids = list(dict.fromkeys(a.model_id for a in agents if a.model_id))

    async def _fetch_models() -> list:
        if not model_ids:
            return []
        async with pool.acquire() as c:
            return await get_models(c, model_ids, redis, bypass_cache)

    models = await _fetch_models()

    provider_ids = list(dict.fromkeys(m.provider_id for m in models if m.provider_id))

    async def _fetch_providers() -> list:
        if not provider_ids:
            return []
        async with pool.acquire() as c:
            return await get_providers(c, provider_ids, redis, bypass_cache)

    providers = await _fetch_providers()

    # Phase 4: Fetch messages + calls for all runs (parallel)
    run_ids = [r.run_id for r in runs]

    async def _fetch_messages() -> list:
        async with pool.acquire() as c:
            return await search_messages(c, run_ids=run_ids, limit=100000)

    async def _fetch_calls() -> list:
        async with pool.acquire() as c:
            return await search_calls(c, run_ids=run_ids, limit=100000)

    messages, calls = await asyncio.gather(
        _fetch_messages(),
        _fetch_calls(),
    )

    # Phase 5: Profile resource for config profile
    config_profile = []
    if common.profile:
        from app.routes.v5.tools.resources.profiles.get import get_profiles

        async with pool.acquire() as c:
            config_profile = await get_profiles(
                c, [common.profile.profiles_id], redis, bypass_cache
            )

    # Build resource_agent_ids + resource_system_ids from tool scores
    resource_agent_ids: dict[str, UUID | None] = {
        target: (tool.agent_id if tool else None)
        for target, tool in scores.best.items()
    }
    resource_system_ids: dict[str, UUID | None] = {
        target: (tool.system_id if tool else None)
        for target, tool in scores.best.items()
    }

    return GroupInternalData(
        group_exists=True,
        runs=runs,
        messages=messages,
        calls=calls,
        config_agents=agents,
        config_models=models,
        config_providers=providers,
        config_tools=tools_list,
        config_systems=systems,
        config_profile=config_profile,
        runs_today=common.runs.runs if common.runs else None,
        resource_agent_ids=resource_agent_ids,
        resource_system_ids=resource_system_ids,
        group_id=group_id,
        actor_name=actor_name,
    )


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_group_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    group_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetGroupWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + domain views."""
    if not group_id:
        raise HTTPException(
            status_code=400,
            detail="group_id is required for websocket.",
        )

    data = await get_group_internal(
        pool=pool,
        profile_id=profile_id,
        group_id=group_id,
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

    return GetGroupWebsocketResponse(
        entries=GroupWebsocketEntries(
            runs=data.runs_today,
            group_runs=data.runs or None,
            messages=data.messages or None,
            calls=data.calls or None,
        ),
        resources=GroupWebsocketResources(),
        systems=data.config_systems or None,
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        params=GetGroupApiRequest(group_id=group_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        resource_system_ids=data.resource_system_ids,
        group_id=data.group_id,
    )


# =============================================================================
# HTTP Endpoint
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
                detail="You don't have access to this group. It may be restricted to other departments.",
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

        # Collect IDs for hydration
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        all_tool_ids: set[UUID] = set()
        for r in data.runs:
            if r.model_ids:
                all_model_ids.update(r.model_ids)
            if r.agent_ids:
                all_agent_ids.update(r.agent_ids)
        for c in data.calls:
            if c.tool_id:
                all_tool_ids.add(c.tool_id)

        # Fetch names + tools via resource layer
        all_name_ids = list(all_model_ids | all_agent_ids | all_profile_ids)
        name_items, tool_items = await asyncio.gather(
            get_names(
                conn, all_name_ids, get_redis_client(), bypass_cache=bypass_cache
            ),
            get_tools(
                conn, list(all_tool_ids), get_redis_client(), bypass_cache=bypass_cache
            ),
        )
        name_map = {item.id: item.name for item in name_items if item.id and item.name}
        tool_name_map: dict[UUID, str] = {
            item.id: item.name for item in tool_items if item.id and item.name
        }

        # Build runs with messages
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

            # Build messages (from MV search — flat SearchMessageResponse)
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
                            template_name=tool_name_map.get(call.tool_id)
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

        # Build resource arrays
        models_list = [
            GroupDetailResourceItem(model_id=mid, name=name_map.get(mid))
            for mid in all_model_ids
        ]
        agents_list = [
            GroupDetailResourceItem(agent_id=aid, name=name_map.get(aid))
            for aid in all_agent_ids
        ]
        profiles_list = [
            GroupDetailResourceItem(profile_id=pid, name=name_map.get(pid))
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

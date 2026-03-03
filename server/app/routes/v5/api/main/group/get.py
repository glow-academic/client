"""Group artifact endpoint - POST /artifacts/group/get

Uses view internals only — no raw SQL in artifact layer.
Fetches from groups_mv, runs_mv, messages_mv, calls_mv via view layer,
then assembles the full group detail in Python.
"""

import asyncio
from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.settings import get_auth_settings_internal
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
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.entries.calls.get import get_call_list_view_internal
from app.routes.v5.tools.entries.groups.get import get_group_list_view_internal
from app.routes.v5.tools.entries.messages.search import (
    get_message_list_entries_internal,
)
from app.routes.v5.tools.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args_internal
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs_internal
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.routes.v5.tools.resources.tools.get import get_tools_internal
from app.sql.types import GetCallListViewSqlRow, GetMessageListViewSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Group entry types for agent resolution
GROUP_BUNDLE_ENTRIES: set[str] = {"debug_info"}

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

    Returns a GroupInternalData dataclass consumed by both the HTTP
    endpoint and the websocket wrapper.
    """
    # 1. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, _tool_ids_map, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, GROUP_BUNDLE_ENTRIES
    )

    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    # 2. Parallel fetch: config agents, config models, config profile, runs today
    async def fetch_config_agents() -> list[Any]:
        if not config_agent_resource_ids:
            return []
        async with pool.acquire() as c:
            return await get_agents_internal(c, config_agent_resource_ids, bypass_cache)

    async def fetch_config_models() -> list[Any]:
        if not config_model_resource_ids:
            return []
        async with pool.acquire() as c:
            return await get_models_internal(c, config_model_resource_ids, bypass_cache)

    async def fetch_config_profile() -> list[Any]:
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
        config_agents_result,
        config_models_result,
        config_profile_result,
        runs_today_result,
    ) = await asyncio.gather(
        fetch_config_agents(),
        fetch_config_models(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    # Derive providers from fetched models (sequential — needs model results)
    config_provider_ids = list(
        dict.fromkeys(
            m.provider_id for m in (config_models_result or []) if m.provider_id
        )
    )
    config_providers_result: list[Any] = []
    if config_provider_ids:
        async with pool.acquire() as c:
            config_providers_result = await get_providers_internal(
                c, config_provider_ids, bypass_cache
            )

    # Fetch tools from config agent (sequential — needs agent results)
    config_tools_result: list[Any] = []
    if config_agents_result:
        agent_resource = config_agents_result[0]
        tool_ids = getattr(agent_resource, "tool_ids", None)
        if tool_ids:
            async with pool.acquire() as c:
                config_tools_result = await get_tools_internal(
                    c, list(tool_ids), bypass_cache
                )

    # 3. Resolve actor name
    async with pool.acquire() as conn:
        actor_name_items = await get_names_internal(conn, [profile_id], bypass_cache)
    actor_name = actor_name_items[0].name if actor_name_items else None

    # 4. Verify group exists
    async with pool.acquire() as conn:
        group_view = await get_group_list_view_internal(
            conn=conn,
            group_ids=[group_id],
            bypass_cache=bypass_cache,
        )

    if not group_view.items:
        raise HTTPException(
            status_code=404,
            detail=f"Group not found: {group_id}",
        )

    # 5. Get runs for group
    async with pool.acquire() as conn:
        runs_result = await get_run_list_entries_internal(
            conn=conn,
            group_id_filter=group_id,
            page_limit=10000,
            sort_order="asc",
            bypass_cache=bypass_cache,
        )

    if not runs_result.items:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this group. It may be restricted to other departments.",
        )

    run_ids = [r.run_id for r in runs_result.items]

    # 6. Fetch messages and calls in parallel
    async def fetch_messages() -> GetMessageListViewSqlRow:
        async with pool.acquire() as c:
            return await get_message_list_entries_internal(
                conn=c,
                run_ids=run_ids,
                bypass_cache=bypass_cache,
            )

    async def fetch_calls() -> GetCallListViewSqlRow:
        async with pool.acquire() as c:
            return await get_call_list_view_internal(
                conn=c,
                run_ids=run_ids,
                bypass_cache=bypass_cache,
            )

    messages_result, calls_result = await asyncio.gather(
        fetch_messages(),
        fetch_calls(),
    )

    return GroupInternalData(
        group_view=group_view,
        runs_result=runs_result,
        messages_result=messages_result,
        calls_result=calls_result,
        config_agents=config_agents_result,
        config_models=config_models_result,
        config_providers=config_providers_result,
        config_tools=config_tools_result,
        config_profile=config_profile_result,
        runs_today=runs_today_result,
        resource_agent_ids=agent_ids,
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

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
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

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetGroupWebsocketResponse(
        entries=GroupWebsocketEntries(
            runs=data.runs_today,
            group_runs=data.runs_result.items if data.runs_result.items else None,
            messages=data.messages_result.items if data.messages_result.items else None,
            calls=data.calls_result.items if data.calls_result.items else None,
        ),
        resources=GroupWebsocketResources(),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        params=GetGroupApiRequest(group_id=group_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
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
        cached = await get_cached(cache_key_val)
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

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(
            conn, data.runs_result.items, bypass_cache
        )

        # Group messages by run_id (already ordered by role precedence + created_at from SQL)
        run_messages: dict[UUID, list] = defaultdict(list)
        for msg in data.messages_result.items:
            if msg.run_id:
                run_messages[msg.run_id].append(msg)

        # Group calls by run_id (calls are linked to messages via call_upload_ids now)
        calls_by_run: dict[UUID, list] = defaultdict(list)
        for call in data.calls_result.items:
            if call.run_id:
                calls_by_run[call.run_id].append(call)

        # Collect IDs for hydration
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        all_tool_ids: set[UUID] = set()
        for r in data.runs_result.items:
            if r.model_ids:
                all_model_ids.update(r.model_ids)
            if r.agent_ids:
                all_agent_ids.update(r.agent_ids)
        for c in data.calls_result.items:
            if c.tool_id:
                all_tool_ids.add(c.tool_id)

        # Fetch names + tools via resource layer (both handle empty lists)
        all_name_ids = list(all_model_ids | all_agent_ids | all_profile_ids)
        name_items, tool_items = await asyncio.gather(
            get_names_internal(conn, all_name_ids, bypass_cache),
            get_tools_internal(conn, list(all_tool_ids), bypass_cache),
        )
        name_map = {item.id: item.name for item in name_items if item.id and item.name}
        tool_name_map: dict[UUID, str] = {
            item.id: item.name for item in tool_items if item.id and item.name
        }

        # Build runs with messages
        runs: list[GroupDetailRunWithMessages] = []
        for r in data.runs_result.items:
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
        models = [
            GroupDetailResourceItem(model_id=mid, name=name_map.get(mid))
            for mid in all_model_ids
        ]
        agents = [
            GroupDetailResourceItem(agent_id=aid, name=name_map.get(aid))
            for aid in all_agent_ids
        ]
        profiles = [
            GroupDetailResourceItem(profile_id=pid, name=name_map.get(pid))
            for pid in all_profile_ids
        ]

        api_response = GetGroupDetailResponse(
            group_exists=True,
            actor_name=data.actor_name,
            runs=runs,
            models=models,
            agents=agents,
            profiles=profiles,
        )

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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_group",
            request=http_request,
        )

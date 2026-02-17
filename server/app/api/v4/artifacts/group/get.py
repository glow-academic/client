"""Group artifact endpoint - POST /artifacts/group/get

Uses view internals only — no raw SQL in artifact layer.
Fetches from groups_mv, runs_mv, messages_mv, calls_mv via view layer,
then assembles the full group detail in Python.
"""

import asyncio
from collections import defaultdict
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts._shared.pricing import compute_costs_from_runs
from app.api.v4.artifacts.group.types import (
    GetGroupDetailRequest,
    GetGroupDetailResponse,
    GroupDetailCallItem,
    GroupDetailContentItem,
    GroupDetailMessageItem,
    GroupDetailResourceItem,
    GroupDetailRunItem,
    GroupDetailRunWithMessages,
)
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.views.call.list.get import get_call_list_view_internal
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.api.v4.views.message.list.get import get_message_list_view_internal
from app.api.v4.views.run.list.get import get_run_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


@router.post(
    "/get",
    response_model=GetGroupDetailResponse,
    dependencies=[audit_activity("group.get", "{{ actor.name }} viewed group detail")],
)
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

        # Resolve actor name via resource layer
        actor_name_items = await get_names_internal(conn, [profile_id], bypass_cache)
        actor_name = actor_name_items[0].name if actor_name_items else None

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Step 1: Verify group exists via lean MV
        group_view = await get_group_list_view_internal(
            conn=conn,
            group_ids=[request.group_id],
            bypass_cache=bypass_cache,
        )

        if not group_view.items:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        # Step 2: Get runs via view internal
        runs_result = await get_run_list_view_internal(
            conn=conn,
            group_id_filter=request.group_id,
            page_limit=10000,
            sort_order="asc",
            bypass_cache=bypass_cache,
        )

        if not runs_result.items:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. It may be restricted to other departments.",
            )

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

        run_ids = [r.run_id for r in runs_result.items]

        # Step 3: Fetch messages and calls via view internals (parallel)
        messages_result, calls_result = await asyncio.gather(
            get_message_list_view_internal(
                conn=conn,
                run_ids=run_ids,
                bypass_cache=bypass_cache,
            ),
            get_call_list_view_internal(
                conn=conn,
                run_ids=run_ids,
                bypass_cache=bypass_cache,
            ),
        )

        # Build call_id → CallViewItem lookup
        call_lookup = {c.call_id: c for c in calls_result.items}

        # Track linked call IDs
        linked_call_ids: set[UUID] = set()
        for msg in messages_result.items:
            linked_call_ids.update(msg.call_ids)

        # Group messages by run_id (already ordered by role precedence + created_at from SQL)
        run_messages: dict[UUID, list] = defaultdict(list)
        for msg in messages_result.items:
            if msg.run_id:
                run_messages[msg.run_id].append(msg)

        # Identify orphan calls per run (calls not linked to any message)
        orphan_calls_by_run: dict[UUID, list] = defaultdict(list)
        for call in calls_result.items:
            if call.call_id not in linked_call_ids and call.run_id:
                orphan_calls_by_run[call.run_id].append(call)

        # Collect IDs for hydration
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        all_tool_ids: set[UUID] = set()
        for r in runs_result.items:
            if r.model_ids:
                all_model_ids.update(r.model_ids)
            if r.agent_ids:
                all_agent_ids.update(r.agent_ids)
        for c in calls_result.items:
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
        for r in runs_result.items:
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
                msg_calls: list[GroupDetailCallItem] = []
                for call_id in msg.call_ids:
                    call = call_lookup.get(call_id)
                    if call:
                        msg_calls.append(
                            GroupDetailCallItem(
                                id=call.call_id,
                                template_name=tool_name_map.get(call.tool_id)
                                if call.tool_id
                                else None,
                                arguments=call.arguments_raw,
                                created_at=call.call_created_at,
                            )
                        )

                contents = [
                    GroupDetailContentItem(content=c) for c in (msg.contents or [])
                ]
                if not contents:
                    contents = [GroupDetailContentItem(content=None)]

                messages.append(
                    GroupDetailMessageItem(
                        id=msg.message_id,
                        role=msg.role,
                        contents=contents,
                        calls=msg_calls,
                    )
                )

            # Attach orphan calls to the last message
            orphan_calls = orphan_calls_by_run.get(run_id, [])
            if orphan_calls and messages:
                for call in orphan_calls:
                    messages[-1].calls.append(
                        GroupDetailCallItem(
                            id=call.call_id,
                            template_name=tool_name_map.get(call.tool_id)
                            if call.tool_id
                            else None,
                            arguments=call.arguments_raw,
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
            actor_name=actor_name,
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

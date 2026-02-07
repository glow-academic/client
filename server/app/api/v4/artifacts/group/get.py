"""Group artifact endpoint - POST /artifacts/group/get

Uses views-layer internal function and hydrates resource names
via get_names_internal (cached, lightweight).
"""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

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
from app.api.v4.views.pricing.group_detail.get import get_pricing_group_detail_internal
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

        # Resolve actor name
        actor_name = await conn.fetchval(
            """
            SELECT n.name
            FROM profile_names_junction pn
            JOIN names_resource n ON pn.name_id = n.id
            WHERE pn.profile_id = $1
            LIMIT 1
            """,
            profile_id,
        )

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Call views-layer internal
        view_result = await get_pricing_group_detail_internal(
            conn=conn,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        if not view_result.group_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        if not view_result.runs:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. It may be restricted to other departments.",
            )

        # Collect unique name resource IDs and build artifact_id → name_id mappings
        all_name_ids: set[UUID] = set()
        model_artifact_to_name_id: dict[UUID, UUID] = {}
        agent_artifact_to_name_id: dict[UUID, UUID] = {}
        profile_artifact_to_name_id: dict[UUID, UUID] = {}

        for run_with_msgs in view_result.runs:
            run = run_with_msgs.run
            if run.model_id and run.model_name_id:
                model_artifact_to_name_id[run.model_id] = run.model_name_id
                all_name_ids.add(run.model_name_id)
            if run.agent_id and run.agent_name_id:
                agent_artifact_to_name_id[run.agent_id] = run.agent_name_id
                all_name_ids.add(run.agent_name_id)
            if run.profile_id and run.profile_name_id:
                profile_artifact_to_name_id[run.profile_id] = run.profile_name_id
                all_name_ids.add(run.profile_name_id)

        # Hydrate names via get_names_internal (cached, lightweight)
        name_id_to_str: dict[UUID, str] = {}
        if all_name_ids:
            name_items = await get_names_internal(
                conn, list(all_name_ids), bypass_cache
            )
            for ni in name_items:
                if ni.id and ni.name:
                    name_id_to_str[ni.id] = ni.name

        # Build runs with artifact-layer types
        runs: list[GroupDetailRunWithMessages] = []
        for view_run in view_result.runs:
            run_item = GroupDetailRunItem(
                id=view_run.run.id,
                created_at=view_run.run.created_at,
                input_tokens=view_run.run.input_tokens,
                output_tokens=view_run.run.output_tokens,
                cached_input_tokens=view_run.run.cached_input_tokens,
                cost=view_run.run.cost,
                model_id=view_run.run.model_id,
                agent_id=view_run.run.agent_id,
                profile_id=view_run.run.profile_id,
            )

            messages: list[GroupDetailMessageItem] = []
            for view_msg in view_run.messages:
                messages.append(
                    GroupDetailMessageItem(
                        id=view_msg.id,
                        role=view_msg.role,
                        contents=[
                            GroupDetailContentItem(content=c.content)
                            for c in view_msg.contents
                        ],
                        calls=[
                            GroupDetailCallItem(
                                id=c.id,
                                template_name=c.template_name,
                                arguments=c.arguments,
                                created_at=c.created_at,
                            )
                            for c in view_msg.calls
                        ],
                    )
                )

            runs.append(
                GroupDetailRunWithMessages(
                    run=run_item,
                    messages=messages,
                    previous_context_start_index=view_run.previous_context_start_index,
                )
            )

        # Build resource arrays from hydrated names
        models = [
            GroupDetailResourceItem(model_id=mid, name=name_id_to_str.get(nid))
            for mid, nid in model_artifact_to_name_id.items()
        ]
        agents = [
            GroupDetailResourceItem(agent_id=aid, name=name_id_to_str.get(nid))
            for aid, nid in agent_artifact_to_name_id.items()
        ]
        profiles = [
            GroupDetailResourceItem(profile_id=pid, name=name_id_to_str.get(nid))
            for pid, nid in profile_artifact_to_name_id.items()
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
